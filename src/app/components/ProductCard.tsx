import { motion } from 'motion/react';
import { ShoppingCart, Heart, Eye } from 'lucide-react';
import { useState } from 'react';

export interface Product {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  rating: number;
}

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  delay?: number;
}

export function ProductCard({ product, onAddToCart, delay = 0 }: ProductCardProps) {
  const [isLiked, setIsLiked] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="group relative bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-shadow duration-300"
    >
      {/* Image container */}
      <div className="relative overflow-hidden aspect-square bg-gray-100">
        <motion.img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover"
          whileHover={{ scale: 1.1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />

        {/* Overlay on hover */}
        <motion.div
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          className="absolute inset-0 bg-black/20 flex items-center justify-center gap-2"
        >
          <motion.button
            initial={{ y: 20, opacity: 0 }}
            whileHover={{ scale: 1.1, y: 0, opacity: 1 }}
            whileTap={{ scale: 0.9 }}
            transition={{ delay: 0.1 }}
            className="p-3 bg-white rounded-full shadow-lg hover:bg-purple-600 hover:text-white transition-colors"
          >
            <Eye className="w-5 h-5" />
          </motion.button>

          <motion.button
            initial={{ y: 20, opacity: 0 }}
            whileHover={{ scale: 1.1, y: 0, opacity: 1 }}
            whileTap={{ scale: 0.9 }}
            transition={{ delay: 0.15 }}
            onClick={() => setIsLiked(!isLiked)}
            className={`p-3 rounded-full shadow-lg transition-colors ${
              isLiked ? 'bg-red-500 text-white' : 'bg-white hover:bg-red-500 hover:text-white'
            }`}
          >
            <Heart className="w-5 h-5" fill={isLiked ? 'currentColor' : 'none'} />
          </motion.button>
        </motion.div>

        {/* Badge */}
        {product.originalPrice && (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: delay + 0.3, type: 'spring' }}
            className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold"
          >
            Sale
          </motion.div>
        )}

        {/* Quick add button */}
        <motion.button
          initial={{ y: 100 }}
          whileHover={{ y: 0 }}
          onClick={() => onAddToCart(product)}
          className="absolute bottom-0 left-0 right-0 bg-purple-600 text-white py-3 font-medium flex items-center justify-center gap-2 hover:bg-purple-700 transition-colors"
        >
          <ShoppingCart className="w-5 h-5" />
          Add to Cart
        </motion.button>
      </div>

      {/* Product info */}
      <div className="p-4">
        <div className="text-sm text-gray-500 mb-1">{product.category}</div>
        <h3 className="font-semibold text-lg mb-2 line-clamp-1">{product.name}</h3>

        {/* Rating */}
        <div className="flex items-center gap-1 mb-3">
          {[...Array(5)].map((_, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: delay + 0.1 * i }}
            >
              <svg
                className={`w-4 h-4 ${
                  i < Math.floor(product.rating) ? 'text-yellow-400' : 'text-gray-300'
                }`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </motion.span>
          ))}
          <span className="text-sm text-gray-600 ml-1">({product.rating})</span>
        </div>

        {/* Price */}
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-purple-600">${product.price}</span>
          {product.originalPrice && (
            <span className="text-gray-400 line-through">${product.originalPrice}</span>
          )}
        </div>
      </div>

      {/* Shine effect */}
      <motion.div
        initial={{ x: '-100%' }}
        whileHover={{ x: '100%' }}
        transition={{ duration: 0.6 }}
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
        style={{ skewX: '-20deg' }}
      />
    </motion.div>
  );
}
