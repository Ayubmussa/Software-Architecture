import { useState } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { FeaturedProducts } from './components/FeaturedProducts';
import { Cart } from './components/Cart';
import { Product } from './components/ProductCard';

const PRODUCTS: Product[] = [
  {
    id: 1,
    name: 'Luxury Chronograph Watch',
    price: 299,
    originalPrice: 399,
    image: 'https://images.unsplash.com/photo-1543707751-e3e5a9359e94?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB3YXRjaCUyMHByb2R1Y3R8ZW58MXx8fHwxNzc2MTkyOTAxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    category: 'Accessories',
    rating: 4.8,
  },
  {
    id: 2,
    name: 'Premium Wireless Headphones',
    price: 179,
    image: 'https://images.unsplash.com/photo-1679533662345-b321cf2d8792?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3aXJlbGVzcyUyMGhlYWRwaG9uZXMlMjBibGFja3xlbnwxfHx8fDE3NzYyMjg0MjB8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    category: 'Electronics',
    rating: 4.9,
  },
  {
    id: 3,
    name: 'Athletic Running Shoes',
    price: 129,
    originalPrice: 159,
    image: 'https://images.unsplash.com/photo-1695459468644-717c8ae17eed?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzbmVha2VycyUyMHJ1bm5pbmclMjBzaG9lc3xlbnwxfHx8fDE3NzYyMTY4Njl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    category: 'Footwear',
    rating: 4.7,
  },
  {
    id: 4,
    name: 'Premium Leather Backpack',
    price: 149,
    image: 'https://images.unsplash.com/photo-1575376653281-1632fc9c61f7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsZWF0aGVyJTIwYmFja3BhY2slMjBmYXNoaW9ufGVufDF8fHx8MTc3NjIzMDIzN3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    category: 'Bags',
    rating: 4.6,
  },
  {
    id: 5,
    name: 'Designer Sunglasses',
    price: 199,
    originalPrice: 249,
    image: 'https://images.unsplash.com/photo-1764333327297-0ebfd9fda541?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdW5nbGFzc2VzJTIwZmFzaGlvbiUyMGFjY2Vzc29yeXxlbnwxfHx8fDE3NzYxOTA1MTB8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    category: 'Accessories',
    rating: 4.8,
  },
  {
    id: 6,
    name: 'Minimalist Coffee Mug',
    price: 24,
    image: 'https://images.unsplash.com/photo-1671187013461-5712c498d808?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaW5pbWFsJTIwY29mZmVlJTIwbXVnfGVufDF8fHx8MTc3NjI3NTYyMXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    category: 'Home',
    rating: 4.5,
  },
  {
    id: 7,
    name: 'Modern Desk Lamp',
    price: 89,
    image: 'https://images.unsplash.com/photo-1766411503488-f90eef1124bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBkZXNrJTIwbGFtcHxlbnwxfHx8fDE3NzYyNDgzODF8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    category: 'Home',
    rating: 4.7,
  },
  {
    id: 8,
    name: 'Indoor Plant Pot',
    price: 34,
    originalPrice: 45,
    image: 'https://images.unsplash.com/photo-1654700203884-42a1fd763164?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwbGFudCUyMHBvdCUyMGluZG9vcnxlbnwxfHx8fDE3NzYyMzAyNDN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    category: 'Home',
    rating: 4.6,
  },
];

interface CartItem extends Product {
  quantity: number;
}

export default function App() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const handleAddToCart = (product: Product) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const handleUpdateQuantity = (id: number, quantity: number) => {
    setCartItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  };

  const handleRemoveItem = (id: number) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-white">
      <Header cartCount={cartCount} onCartClick={() => setIsCartOpen(true)} />
      <Hero />
      <FeaturedProducts products={PRODUCTS} onAddToCart={handleAddToCart} />
      <Cart
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
      />
    </div>
  );
}
