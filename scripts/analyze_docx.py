import sys
import os
import json
from collections import Counter

try:
    from docx import Document
except Exception as e:
    print('Missing python-docx. Install with: pip install python-docx')
    raise

STOPWORDS = set([
    'the','and','to','of','in','a','is','for','with','that','on','as','are','by','an','be','this','it','or','from','at','which','these','we','can','will','have','has','via'
])


def extract_paragraphs_with_styles(path):
    doc = Document(path)
    items = []
    for p in doc.paragraphs:
        text = p.text.strip()
        if not text:
            continue
        style = ''
        try:
            style = p.style.name if p.style and p.style.name else ''
        except Exception:
            style = ''
        items.append({'text': text, 'style': style})
    return items


def build_structure(items):
    structure = []
    current = {'heading': 'Front Matter', 'level': 0, 'paragraphs': []}
    for it in items:
        style = (it['style'] or '').lower()
        if style.startswith('heading'):
            # start a new section
            structure.append(current)
            current = {'heading': it['text'], 'level': style, 'paragraphs': []}
        else:
            current['paragraphs'].append(it['text'])
    structure.append(current)
    # remove initial empty front matter if empty
    return [s for s in structure if s['paragraphs'] or s['heading']]


def summarize_section(paragraphs):
    if not paragraphs:
        return ''
    full = ' '.join(paragraphs)
    # pick first sentence as lead
    lead = paragraphs[0].split('. ')[0].strip()
    # compute top words
    words = [w.strip('.,()[]:;\"\'\"').lower() for w in full.split()]
    words = [w for w in words if w and w not in STOPWORDS]
    top = Counter(words).most_common(5)
    top_words = ', '.join([w for w,_ in top])
    summary = lead
    if top_words:
        summary += ' — keywords: ' + top_words
    return summary


def analyze_structure(struct):
    summary = {'sections': [], 'top_words': [], 'word_count': 0, 'char_count': 0}
    all_text = []
    for s in struct:
        sec_text = ' '.join(s['paragraphs'])
        all_text.append(sec_text)
        sec_summary = summarize_section(s['paragraphs'])
        summary['sections'].append({'heading': s['heading'], 'summary': sec_summary, 'paragraph_count': len(s['paragraphs'])})
    full = '\n\n'.join(all_text)
    words = [w.strip('.,()[]:;\"\'\"').lower() for w in full.split()]
    words = [w for w in words if w and w not in STOPWORDS]
    summary['word_count'] = len(words)
    summary['char_count'] = len(full)
    summary['top_words'] = Counter(words).most_common(30)
    return summary


if __name__ == '__main__':
    args = sys.argv
    if len(args) > 1:
        path = args[1]
    else:
        path = os.path.join('.', 'Microservices_Project_Report.docx')
    if not os.path.exists(path):
        print('File not found:', path)
        sys.exit(2)
    items = extract_paragraphs_with_styles(path)
    struct = build_structure(items)
    result = analyze_structure(struct)

    out_dir = os.path.join('.', 'output')
    os.makedirs(out_dir, exist_ok=True)
    txt_path = os.path.join(out_dir, 'Microservices_Project_Report_analysis.txt')
    json_path = os.path.join(out_dir, 'Microservices_Project_Report_analysis.json')

    with open(txt_path, 'w', encoding='utf-8') as f:
        f.write('Analysis of ' + os.path.basename(path) + '\n')
        f.write('='*60 + '\n')
        f.write(f"Paragraphs (by section): {sum([s['paragraph_count'] for s in result['sections']])}\n")
        f.write(f"Word tokens (filtered): {result['word_count']}\n")
        f.write(f"Characters: {result['char_count']}\n\n")
        f.write('Top words:\n')
        for w,c in result['top_words'][:20]:
            f.write(f"  {w}: {c}\n")
        f.write('\nSections and summaries:\n')
        for s in result['sections']:
            f.write(f"\n{ s['heading'] }\n  Paragraphs: {s['paragraph_count']}\n  Summary: {s['summary']}\n")

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print('Analysis written to', txt_path)
    print('Structured JSON written to', json_path)
