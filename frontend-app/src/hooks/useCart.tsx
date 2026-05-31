import { createContext, useContext, useMemo, useState } from 'react'
import type { Product } from '../api/products'

export interface CartItem {
  product: Product
  quantity: number
}

interface CartContextValue {
  items: CartItem[]
  total: number
  addToCart: (product: Product) => void
  removeFromCart: (productId: number) => void
  clearCart: () => void
}

const CartContext = createContext<CartContextValue | undefined>(undefined)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])

  function addToCart(product: Product) {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
  }

  function removeFromCart(productId: number) {
    setItems((prev) => prev.filter((i) => i.product.id !== productId))
  }

  function clearCart() {
    setItems([])
  }

  const total = useMemo(
    () => items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
    [items],
  )

  return (
    <CartContext.Provider value={{ items, total, addToCart, removeFromCart, clearCart }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) {
    throw new Error('useCart must be used within CartProvider')
  }
  return ctx
}

