from fastapi import Depends, FastAPI, HTTPException, Request, Response, Header, status
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from sqlalchemy.exc import SQLAlchemyError

from . import models, schemas
from .database import Base, SessionLocal, engine
from .search import delete_product as unindex_product
from .search import index_product, ping, search_product_ids


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _safe_bootstrap_db() -> None:
    """
    Keep module import resilient in CI where Postgres may be unavailable.
    Runtime API calls still require a reachable DB connection.
    """
    try:
        Base.metadata.create_all(bind=engine)
    except SQLAlchemyError:
        pass


def _ensure_legacy_schema_compatibility() -> None:
    """Backfill columns for existing dev DBs created before newer fields existed."""
    ddl_statements = [
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR(512)",
        "ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS verified_purchase INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS helpful_votes INTEGER NOT NULL DEFAULT 0",
    ]
    try:
        with engine.begin() as conn:
            for stmt in ddl_statements:
                conn.execute(text(stmt))
    except Exception:
        # Keep startup resilient; create_all already handles fresh DBs.
        pass


app = FastAPI(
    title="Product Service",
    version="1.0.0",
    description="Manages product listings, categories, and inventories.",
)


@app.on_event("startup")
def _startup_db_bootstrap() -> None:
    _safe_bootstrap_db()
    _ensure_legacy_schema_compatibility()


def _attach_ratings(db: Session, products: list[models.Product]) -> list[models.Product]:
    if not products:
        return products
    ids = [p.id for p in products]
    rows = (
        db.query(
            models.ProductReview.product_id,
            func.avg(models.ProductReview.rating).label("avg_rating"),
            func.count(models.ProductReview.id).label("count_reviews"),
        )
        .filter(models.ProductReview.product_id.in_(ids))
        .group_by(models.ProductReview.product_id)
        .all()
    )
    by_id = {int(r.product_id): (float(r.avg_rating), int(r.count_reviews)) for r in rows}
    for p in products:
        avg_count = by_id.get(p.id)
        if avg_count:
            p.rating_avg = round(avg_count[0], 2)
            p.rating_count = avg_count[1]
        else:
            p.rating_avg = None
            p.rating_count = 0
    return products


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "product-service",
        "search": "up" if ping() else "down",
    }


@app.post(
    "/api/products",
    response_model=schemas.ProductOut,
    status_code=status.HTTP_201_CREATED,
)
def create_product(payload: schemas.ProductCreate, db: Session = Depends(get_db)):
    product = models.Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    index_product(product)
    return product


@app.get("/api/products/categories", response_model=list[str])
def list_categories(db: Session = Depends(get_db)):
    rows = (
        db.query(models.Product.category)
        .filter(models.Product.category != None)  # noqa: E711
        .distinct()
        .all()
    )
    return [r[0] for r in rows if r[0]]


@app.get("/api/products", response_model=list[schemas.ProductOut])
def list_products(
    skip: int = 0,
    limit: int = 20,
    q: str | None = None,
    category: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    in_stock_only: bool = False,
    ids: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Product)
    if ids and ids.strip():
        id_list = [int(x) for x in ids.split(",") if x.strip().isdigit()]
        if id_list:
            query = query.filter(models.Product.id.in_(id_list))
    searched_ids: list[int] | None = None
    if q and q.strip():
        searched_ids = search_product_ids(q.strip(), size=min(limit * 5, 200))
        if searched_ids is None:
            # Elasticsearch is unavailable; fallback to SQL ILIKE
            term = f"%{q.strip()}%"
            query = query.filter(
                (models.Product.name.ilike(term)) | (models.Product.description.ilike(term))
            )
        elif len(searched_ids) == 0:
            return []
        else:
            query = query.filter(models.Product.id.in_(searched_ids))
    if category and category.strip():
        query = query.filter(models.Product.category == category.strip())
    if min_price is not None:
        query = query.filter(models.Product.price >= min_price)
    if max_price is not None:
        query = query.filter(models.Product.price <= max_price)
    if in_stock_only:
        query = query.filter(models.Product.stock > 0)
    products = query.offset(max(skip, 0)).limit(min(limit, 100)).all()
    if searched_ids:
        rank = {pid: idx for idx, pid in enumerate(searched_ids)}
        products.sort(key=lambda p: rank.get(p.id, 10_000))
    return _attach_ratings(db, products)


@app.get("/api/products/recommendations", response_model=list[schemas.ProductOut])
def recommend_products(
    product_id: int | None = None,
    wishlist_ids: str | None = None,
    limit: int = 8,
    db: Session = Depends(get_db),
):
    target_limit = max(1, min(limit, 24))

    excluded_ids: set[int] = set()
    preferred_categories: list[str] = []
    anchor_prices: list[float] = []

    if product_id is not None and product_id > 0:
        ref = db.query(models.Product).filter(models.Product.id == product_id).first()
        if ref:
            excluded_ids.add(ref.id)
            if ref.category:
                preferred_categories.append(ref.category)
            if ref.price is not None:
                anchor_prices.append(float(ref.price))

    wishlist_parsed: list[int] = []
    if wishlist_ids and wishlist_ids.strip():
        wishlist_parsed = [int(x) for x in wishlist_ids.split(",") if x.strip().isdigit()]
    if wishlist_parsed:
        wishlist_products = (
            db.query(models.Product)
            .filter(models.Product.id.in_(wishlist_parsed))
            .all()
        )
        for wp in wishlist_products:
            excluded_ids.add(wp.id)
            if wp.category:
                preferred_categories.append(wp.category)
            if wp.price is not None:
                anchor_prices.append(float(wp.price))

    candidates = (
        db.query(models.Product)
        .filter(models.Product.stock > 0)
        .limit(400)
        .all()
    )
    if excluded_ids:
        candidates = [c for c in candidates if c.id not in excluded_ids]

    category_weights: dict[str, int] = {}
    for cat in preferred_categories:
        category_weights[cat] = category_weights.get(cat, 0) + 1
    avg_anchor_price = (sum(anchor_prices) / len(anchor_prices)) if anchor_prices else None

    def score(product: models.Product) -> tuple[float, int, int]:
        score_value = 0.0
        if product.category and product.category in category_weights:
            score_value += 3.0 + category_weights[product.category] * 0.6
        if avg_anchor_price is not None and product.price is not None:
            price_gap = abs(float(product.price) - avg_anchor_price)
            score_value += max(0.0, 2.5 - (price_gap / max(avg_anchor_price, 1.0)) * 2.5)
        score_value += min(float(product.stock), 50.0) / 50.0
        return (score_value, int(product.stock), -int(product.id))

    ranked = sorted(candidates, key=score, reverse=True)
    return _attach_ratings(db, ranked[:target_limit])


@app.get("/api/products/{product_id}", response_model=schemas.ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return _attach_ratings(db, [product])[0]


@app.put("/api/products/{product_id}", response_model=schemas.ProductOut)
def update_product(
    product_id: int, payload: schemas.ProductUpdate, db: Session = Depends(get_db)
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)

    db.add(product)
    db.commit()
    db.refresh(product)
    index_product(product)
    return product


@app.delete("/api/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    db.delete(product)
    db.commit()
    unindex_product(product_id)
    return None


@app.post("/api/products/search/reindex")
def reindex_products(db: Session = Depends(get_db)):
    products = db.query(models.Product).all()
    for product in products:
        index_product(product)
    return {"reindexed": len(products)}


@app.post("/api/products/reserve")
def reserve_inventory(payload: schemas.InventoryAdjustRequest, db: Session = Depends(get_db)):
    requested = payload.items
    merged: dict[int, int] = {}
    for item in requested:
        merged[item.productId] = merged.get(item.productId, 0) + item.quantity

    product_ids = list(merged.keys())
    products = (
        db.query(models.Product)
        .filter(models.Product.id.in_(product_ids))
        .with_for_update()
        .all()
    )
    by_id = {p.id: p for p in products}
    missing = [pid for pid in product_ids if pid not in by_id]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Products not found: {missing}",
        )

    insufficient: list[dict[str, int]] = []
    for pid, qty in merged.items():
        product = by_id[pid]
        if product.stock < qty:
            insufficient.append(
                {"productId": pid, "requested": qty, "available": int(product.stock)}
            )
    if insufficient:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Insufficient stock", "items": insufficient},
        )

    for pid, qty in merged.items():
        by_id[pid].stock = int(by_id[pid].stock) - qty

    db.commit()
    for product in products:
        index_product(product)
    return {"reserved": True, "items": [{"productId": pid, "quantity": qty} for pid, qty in merged.items()]}


@app.post("/api/products/release")
def release_inventory(payload: schemas.InventoryAdjustRequest, db: Session = Depends(get_db)):
    requested = payload.items
    merged: dict[int, int] = {}
    for item in requested:
        merged[item.productId] = merged.get(item.productId, 0) + item.quantity

    product_ids = list(merged.keys())
    products = (
        db.query(models.Product)
        .filter(models.Product.id.in_(product_ids))
        .with_for_update()
        .all()
    )
    by_id = {p.id: p for p in products}

    for pid, qty in merged.items():
        product = by_id.get(pid)
        if product:
            product.stock = int(product.stock) + qty

    db.commit()
    for product in products:
        index_product(product)
    return {"released": True, "items": [{"productId": pid, "quantity": qty} for pid, qty in merged.items()]}


@app.get("/api/products/{product_id}/reviews", response_model=list[schemas.ReviewOut])
def list_reviews(
    product_id: int,
    skip: int = 0,
    limit: int = 5,
    sort: str = "newest",
    response: Response = None,
    x_voter_key: str | None = Header(default=None),
    request: Request = None,
    db: Session = Depends(get_db),
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    query = db.query(models.ProductReview).filter(models.ProductReview.product_id == product_id)
    total_count = query.count()
    if response is not None:
        response.headers["X-Total-Count"] = str(total_count)
    if sort == "highest":
        query = query.order_by(models.ProductReview.rating.desc(), models.ProductReview.created_at.desc())
    elif sort == "lowest":
        query = query.order_by(models.ProductReview.rating.asc(), models.ProductReview.created_at.desc())
    elif sort == "helpful":
        query = query.order_by(models.ProductReview.helpful_votes.desc(), models.ProductReview.created_at.desc())
    else:
        query = query.order_by(models.ProductReview.created_at.desc())
    target_limit = max(1, min(limit, 50))
    target_skip = max(0, skip)
    reviews = query.offset(target_skip).limit(target_limit).all()
    voter_key = _resolve_voter_key(x_voter_key, request)
    if voter_key:
        review_ids = [r.id for r in reviews]
        voted_ids = set(
            row[0]
            for row in db.query(models.ReviewHelpfulVote.review_id)
            .filter(
                models.ReviewHelpfulVote.voter_key == voter_key,
                models.ReviewHelpfulVote.review_id.in_(review_ids) if review_ids else True,
            )
            .all()
        )
        for r in reviews:
            r.has_voted = r.id in voted_ids
    return reviews


def _resolve_voter_key(x_voter_key: str | None, request: Request | None) -> str:
    key = (x_voter_key or "").strip()
    if key:
        return key[:255]
    if request and request.client and request.client.host:
        return f"ip:{request.client.host}"[:255]
    return ""


@app.get("/api/products/{product_id}/reviews/meta", response_model=schemas.ReviewMetaOut)
def reviews_meta(product_id: int, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    total = (
        db.query(func.count(models.ProductReview.id))
        .filter(models.ProductReview.product_id == product_id)
        .scalar()
    )
    return {"totalCount": int(total or 0)}


@app.post(
    "/api/products/{product_id}/reviews",
    response_model=schemas.ReviewOut,
    status_code=status.HTTP_201_CREATED,
)
def create_review(product_id: int, payload: schemas.ReviewCreate, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    review = models.ProductReview(
        product_id=product_id,
        author_name=payload.author_name.strip(),
        rating=payload.rating,
        comment=payload.comment.strip() if payload.comment else None,
        verified_purchase=1 if payload.verified_purchase else 0,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


@app.put("/api/products/{product_id}/reviews/{review_id}", response_model=schemas.ReviewOut)
def update_review(
    product_id: int,
    review_id: int,
    payload: schemas.ReviewUpdate,
    force: bool = False,
    db: Session = Depends(get_db),
):
    review = (
        db.query(models.ProductReview)
        .filter(
            models.ProductReview.id == review_id,
            models.ProductReview.product_id == product_id,
        )
        .first()
    )
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    if not force and review.author_name.strip().lower() != payload.author_name.strip().lower():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the author can edit this review")
    review.rating = payload.rating
    review.comment = payload.comment.strip() if payload.comment else None
    db.commit()
    db.refresh(review)
    return review


@app.delete("/api/products/{product_id}/reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review(
    product_id: int,
    review_id: int,
    author_name: str | None = None,
    force: bool = False,
    db: Session = Depends(get_db),
):
    review = (
        db.query(models.ProductReview)
        .filter(
            models.ProductReview.id == review_id,
            models.ProductReview.product_id == product_id,
        )
        .first()
    )
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    if not force:
        if not author_name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="author_name is required")
        if review.author_name.strip().lower() != author_name.strip().lower():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the author can delete this review")
    db.delete(review)
    db.commit()
    return None


@app.get("/api/products/reviews", response_model=list[schemas.ReviewOut])
def admin_list_reviews(
    skip: int = 0,
    limit: int = 100,
    q: str | None = None,
    db: Session = Depends(get_db),
):
    target_limit = max(1, min(limit, 250))
    target_skip = max(0, skip)
    query = db.query(models.ProductReview)
    if q and q.strip():
        token = f"%{q.strip()}%"
        query = query.filter(
            (models.ProductReview.author_name.ilike(token))
            | (models.ProductReview.comment.ilike(token))
        )
    return query.order_by(models.ProductReview.created_at.desc()).offset(target_skip).limit(target_limit).all()


@app.delete("/api/products/reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_review(review_id: int, db: Session = Depends(get_db)):
    review = db.query(models.ProductReview).filter(models.ProductReview.id == review_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    db.delete(review)
    db.commit()
    return None


@app.post("/api/products/{product_id}/reviews/{review_id}/helpful", response_model=schemas.ReviewOut)
def mark_review_helpful(
    product_id: int,
    review_id: int,
    x_voter_key: str | None = Header(default=None),
    request: Request = None,
    db: Session = Depends(get_db),
):
    review = (
        db.query(models.ProductReview)
        .filter(
            models.ProductReview.id == review_id,
            models.ProductReview.product_id == product_id,
        )
        .first()
    )
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    voter_key = _resolve_voter_key(x_voter_key, request)
    if not voter_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing voter identity")
    exists = (
        db.query(models.ReviewHelpfulVote)
        .filter(
            models.ReviewHelpfulVote.review_id == review.id,
            models.ReviewHelpfulVote.voter_key == voter_key,
        )
        .first()
    )
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You already marked this review as helpful")
    db.add(models.ReviewHelpfulVote(review_id=review.id, voter_key=voter_key))
    review.helpful_votes = int(review.helpful_votes or 0) + 1
    db.commit()
    db.refresh(review)
    review.has_voted = True
    return review



