import './App.css'
import { AnimatePresence, motion } from 'framer-motion'
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useCart } from './hooks/useCart'
import { fetchProducts, fetchProductsPage, fetchCategories, fetchProduct, fetchRecommendations, fetchProductReviews, fetchProductReviewsMeta, createProductReview, updateProductReview, deleteProductReview, markReviewHelpful, createProduct, updateProduct, deleteProduct, type Product, type ProductReview, type ProductCreatePayload, type ProductUpdatePayload } from './api/products'
import { addWishlistItem, getWishlist, removeWishlistItem } from './api/wishlist'
import {
  createOrder,
  createPaymentIntent,
  confirmPayment,
  getOrdersForUser,
  getAllOrders,
  updateOrderStatus,
  type OrderResponse,
} from './api/orders'
import {
  adminListUsers,
  adminUpdateUser,
  adminDeleteUser,
  adminListReviews,
  adminDeleteReview,
  adminUpdateReview,
  adminListPromotions,
  adminCreatePromotion,
  adminTogglePromotion,
  adminDeletePromotion,
  adminUpdateShipment,
  adminOpsOverview,
  adminOrderAnalytics,
  adminAuditLogs,
  type AdminUser,
  type AdminAuditLog,
  type OrderAnalytics,
  type PromotionRule,
} from './api/admin'

type Screen = 'landing' | 'auth' | 'catalog' | 'wishlist' | 'notifications' | 'orders' | 'admin' | 'profile'
type NotificationKind = 'orders' | 'wishlist' | 'reviews' | 'account'

type ApiErrorShape = {
  response?: { data?: { message?: string; detail?: string } }
}

function getApiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as ApiErrorShape | undefined)?.response?.data
  return data?.message ?? data?.detail ?? fallback
}

type OpsOverview = {
  gateway?: string
  services?: { user?: string; product?: string; order?: string }
} | null

type ShipmentStep = {
  key: 'placed' | 'paid' | 'shipped' | 'delivered'
  label: string
  done: boolean
  active: boolean
  at?: string | null
}

function buildShipmentSteps(order: OrderResponse): ShipmentStep[] {
  const status = (order.status || '').toUpperCase()
  const cancelled = status === 'CANCELLED'
  const placedAt = order.createdAt
  const paidAt = order.paidAt ?? null
  const shippedAt = order.shippedAt ?? null
  const deliveredAt = order.deliveredAt ?? null

  const placed = true
  const paid = !!paidAt || ['PAID', 'SHIPPED', 'COMPLETED'].includes(status)
  const shipped = !!shippedAt || ['SHIPPED', 'COMPLETED'].includes(status)
  const delivered = !!deliveredAt || status === 'COMPLETED'

  const steps: ShipmentStep[] = [
    { key: 'placed', label: 'Order placed', done: placed, active: placed && !paid && !cancelled, at: placedAt },
    { key: 'paid', label: 'Payment confirmed', done: paid, active: paid && !shipped && !cancelled, at: paidAt },
    { key: 'shipped', label: 'Shipped', done: shipped, active: shipped && !delivered && !cancelled, at: shippedAt },
    { key: 'delivered', label: 'Delivered', done: delivered, active: delivered && !cancelled, at: deliveredAt },
  ]
  return steps
}

function PaginationControls({
  page,
  pageSize,
  total,
  loading,
  onPageChange,
}: {
  page: number
  pageSize: number
  total: number
  loading?: boolean
  onPageChange: (page: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize && totalPages <= 1) return null

  const firstVisible = Math.max(1, page - 2)
  const lastVisible = Math.min(totalPages, firstVisible + 4)
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(total, page * pageSize)

  return (
    <div className="pagination-bar">
      <span className="pagination-summary">
        Showing {start}-{end} of {total}
      </span>
      <div className="pagination-actions">
        <button type="button" className="btn-secondary" disabled={loading || page <= 1} onClick={() => onPageChange(page - 1)}>
          Prev
        </button>
        {Array.from({ length: lastVisible - firstVisible + 1 }, (_, idx) => firstVisible + idx).map((p) => (
          <button
            key={p}
            type="button"
            className={p === page ? 'btn-secondary active' : 'btn-ghost'}
            disabled={loading || p === page}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ))}
        <button type="button" className="btn-secondary" disabled={loading || page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
        </button>
      </div>
    </div>
  )
}

function App() {
  const [screen, setScreen] = useState<Screen>('landing')
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const { user, token, loading, login, register, updateProfile, logout } = useAuth()
  const { items, total, addToCart, removeFromCart, clearCart } = useCart()
  const [products, setProducts] = useState<Product[] | null>(null)
  const [productsLoading, setProductsLoading] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null)
  const [couponCode, setCouponCode] = useState('')
  const [shippingAddress, setShippingAddress] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [wishlistIds, setWishlistIds] = useState<number[]>([])
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([])
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([])
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([])
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<number[]>([])
  const [recentlyViewedProducts, setRecentlyViewedProducts] = useState<Product[]>([])
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; createdAt: string; read: boolean; kind: NotificationKind }>>([])
  const [notificationFilter, setNotificationFilter] = useState<'all' | NotificationKind>('all')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [minPrice, setMinPrice] = useState<string>('')
  const [maxPrice, setMaxPrice] = useState<string>('')
  const [inStockOnly, setInStockOnly] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const [productPage, setProductPage] = useState(1)
  const [productTotal, setProductTotal] = useState(0)
  const [orders, setOrders] = useState<OrderResponse[] | null>(null)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [orderProductNames, setOrderProductNames] = useState<Record<number, string>>({})
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [productDetail, setProductDetail] = useState<Product | null>(null)
  const [productDetailLoading, setProductDetailLoading] = useState(false)
  const [productReviews, setProductReviews] = useState<ProductReview[]>([])
  const [reviewSort, setReviewSort] = useState<'newest' | 'highest' | 'lowest' | 'helpful'>('newest')
  const [reviewHasMore, setReviewHasMore] = useState(false)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewHelpfulBusyId, setReviewHelpfulBusyId] = useState<number | null>(null)
  const [reviewTotalCount, setReviewTotalCount] = useState(0)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewEditingId, setReviewEditingId] = useState<number | null>(null)
  const [purchasedProductIds, setPurchasedProductIds] = useState<number[]>([])
  const [adminProducts, setAdminProducts] = useState<Product[]>([])
  const [adminProductsLoading, setAdminProductsLoading] = useState(false)
  const [adminFormOpen, setAdminFormOpen] = useState<'create' | number | null>(null)
  const [adminFormSaving, setAdminFormSaving] = useState(false)
  const [adminTab, setAdminTab] = useState<'products' | 'orders' | 'users' | 'reviews' | 'promotions' | 'analytics' | 'ops'>('products')
  const [orderAnalytics, setOrderAnalytics] = useState<OrderAnalytics | null>(null)
  const [orderAnalyticsLoading, setOrderAnalyticsLoading] = useState(false)
  const [orderAnalyticsWindow, setOrderAnalyticsWindow] = useState<7 | 14 | 30 | 90>(30)
  const [allOrders, setAllOrders] = useState<OrderResponse[]>([])
  const [allOrdersLoading, setAllOrdersLoading] = useState(false)
  const [adminOrdersPage, setAdminOrdersPage] = useState(1)
  const [adminOrdersTotal, setAdminOrdersTotal] = useState(0)
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [adminUsersLoading, setAdminUsersLoading] = useState(false)
  const [adminUsersQuery, setAdminUsersQuery] = useState('')
  const [adminUsersPage, setAdminUsersPage] = useState(1)
  const [adminUsersTotal, setAdminUsersTotal] = useState(0)
  const [adminReviews, setAdminReviews] = useState<ProductReview[]>([])
  const [adminReviewsLoading, setAdminReviewsLoading] = useState(false)
  const [adminReviewsQuery, setAdminReviewsQuery] = useState('')
  const [adminReviewsPage, setAdminReviewsPage] = useState(1)
  const [adminReviewsTotal, setAdminReviewsTotal] = useState(0)
  const [adminReviewEdit, setAdminReviewEdit] = useState<{ id: number; product_id: number; author_name: string; rating: number; comment: string } | null>(null)
  const [adminPromotions, setAdminPromotions] = useState<PromotionRule[]>([])
  const [adminPromotionsLoading, setAdminPromotionsLoading] = useState(false)
  const [adminPromotionsPage, setAdminPromotionsPage] = useState(1)
  const [newPromotion, setNewPromotion] = useState({
    code: '',
    percentOff: '10',
    minBasketAmount: '0',
    maxUses: '',
    expiresAt: '',
    categoryScope: '',
  })
  const [opsOverview, setOpsOverview] = useState<OpsOverview>(null)
  const [adminAuditEntries, setAdminAuditEntries] = useState<AdminAuditLog[]>([])
  const [adminAuditLoading, setAdminAuditLoading] = useState(false)
  const [adminAuditQuery, setAdminAuditQuery] = useState('')
  const [adminAuditPage, setAdminAuditPage] = useState(1)
  const [adminAuditTotal, setAdminAuditTotal] = useState(0)
  const [adminProductsPage, setAdminProductsPage] = useState(1)
  const [adminProductsTotal, setAdminProductsTotal] = useState(0)
  const [shipmentDrafts, setShipmentDrafts] = useState<Record<number, { trackingId: string; status: 'SHIPPED' | 'DELIVERED' }>>({})
  const [adminFormData, setAdminFormData] = useState({ name: '', description: '', category: '', price: '', stock: '0', image_url: '' })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const currentScreenLabel: Record<Screen, string> = {
    landing: 'Landing',
    auth: 'Authentication',
    catalog: 'Catalog',
    wishlist: 'Wishlist',
    notifications: 'Notifications',
    orders: 'Orders',
    admin: 'Admin',
    profile: 'Profile',
  }

  const CATALOG_PAGE_SIZE = 12
  const ADMIN_PAGE_SIZE = 25
  const AUDIT_PAGE_SIZE = 20
  const pagedAdminPromotions = adminPromotions.slice(
    (adminPromotionsPage - 1) * ADMIN_PAGE_SIZE,
    adminPromotionsPage * ADMIN_PAGE_SIZE
  )

  async function loadProducts(page = productPage) {
    setProductsLoading(true)
    setApiError(null)
    try {
      const data = await fetchProductsPage({
        q: searchQuery || undefined,
        category: categoryFilter || undefined,
        min_price: minPrice !== '' ? Number(minPrice) : undefined,
        max_price: maxPrice !== '' ? Number(maxPrice) : undefined,
        in_stock_only: inStockOnly || undefined,
        skip: (page - 1) * CATALOG_PAGE_SIZE,
        limit: CATALOG_PAGE_SIZE,
      })
      setProducts(data.items)
      setProductTotal(data.total)
    } catch (err) {
      setApiError(getApiErrorMessage(err, 'Failed to load products'))
    } finally {
      setProductsLoading(false)
    }
  }

  const unreadNotifications = notifications.filter((n) => !n.read).length
  const unreadByKind: Record<NotificationKind, number> = {
    orders: notifications.filter((n) => !n.read && n.kind === 'orders').length,
    wishlist: notifications.filter((n) => !n.read && n.kind === 'wishlist').length,
    reviews: notifications.filter((n) => !n.read && n.kind === 'reviews').length,
    account: notifications.filter((n) => !n.read && n.kind === 'account').length,
  }
  const filteredNotifications =
    notificationFilter === 'all'
      ? notifications
      : notifications.filter((n) => n.kind === notificationFilter)

  function pushNotification(message: string, kind: NotificationKind) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      message,
      createdAt: new Date().toISOString(),
      read: false,
      kind,
    }
    setNotifications((prev) => [entry, ...prev].slice(0, 40))
  }

  function openProduct(productId: number) {
    setSelectedProductId(productId)
    setRecentlyViewedIds((prev) => [productId, ...prev.filter((id) => id !== productId)].slice(0, 12))
  }

  function markNotificationRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  function clearNotifications(scope: 'all' | 'filtered') {
    if (scope === 'all') {
      setNotifications([])
      return
    }
    if (notificationFilter === 'all') {
      setNotifications([])
      return
    }
    setNotifications((prev) => prev.filter((n) => n.kind !== notificationFilter))
  }

  async function loadProductReviewsPage(productId: number, append: boolean) {
    setReviewLoading(true)
    try {
      const nextSkip = append ? productReviews.length : 0
      const pageSize = 5
      const [page, meta] = await Promise.all([
        fetchProductReviews(productId, { skip: nextSkip, limit: pageSize, sort: reviewSort }),
        fetchProductReviewsMeta(productId),
      ])
      setReviewTotalCount(meta.totalCount)
      setProductReviews((prev) => (append ? [...prev, ...page] : page))
      const shown = (append ? productReviews.length : 0) + page.length
      setReviewHasMore(shown < meta.totalCount)
    } catch {
      if (!append) setProductReviews([])
      setReviewHasMore(false)
      if (!append) setReviewTotalCount(0)
    } finally {
      setReviewLoading(false)
    }
  }

  useEffect(() => {
    if (screen !== 'catalog') return
    fetchCategories().then(setCategories)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on catalog mount only
  }, [screen])

  useEffect(() => {
    if (screen !== 'catalog') return
    // Debounce so typing in the search/price boxes doesn't fire a request per keystroke.
    const handle = setTimeout(() => {
      loadProducts(productPage)
    }, 300)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: re-run when any filter changes
  }, [screen, searchQuery, categoryFilter, minPrice, maxPrice, inStockOnly, productPage])

  useEffect(() => {
    if (screen !== 'landing') return
    if (products && products.length > 0) return
    fetchProducts({ limit: 16 })
      .then(setProducts)
      .catch(() => {})
  }, [screen, products])

  useEffect(() => {
    if (screen !== 'landing' && screen !== 'catalog') return
    fetchRecommendations({ wishlist_ids: wishlistIds, limit: 8 })
      .then(setRecommendedProducts)
      .catch(() => setRecommendedProducts([]))
  }, [screen, wishlistIds])

  useEffect(() => {
    if (!token) {
      setWishlistIds([])
      setWishlistProducts([])
      return
    }
    getWishlist(token)
      .then((ids) => setWishlistIds(ids))
      .catch(() => setWishlistIds([]))
  }, [token])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = window.localStorage.getItem('multishop.notifications')
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        setNotifications(parsed.map((n) => ({ ...n, kind: n.kind ?? 'account' })))
      }
    } catch {
      // ignore invalid localStorage
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('multishop.notifications', JSON.stringify(notifications))
  }, [notifications])

  useEffect(() => {
    if (recentlyViewedIds.length === 0) {
      setRecentlyViewedProducts([])
      return
    }
    fetchProducts({ ids: recentlyViewedIds, limit: 50 })
      .then((data) => {
        const byId = new Map(data.map((p) => [p.id, p]))
        setRecentlyViewedProducts(recentlyViewedIds.map((id) => byId.get(id)).filter(Boolean) as Product[])
      })
      .catch(() => setRecentlyViewedProducts([]))
  }, [recentlyViewedIds])

  useEffect(() => {
    if (screen !== 'wishlist') return
    if (wishlistIds.length === 0) {
      setWishlistProducts([])
      return
    }
    fetchProducts({ ids: wishlistIds, limit: 300 })
      .then((data) => setWishlistProducts(data))
      .catch(() => setWishlistProducts([]))
  }, [screen, wishlistIds])

  useEffect(() => {
    if (!user?.orderUserId) {
      setPurchasedProductIds([])
      return
    }
    getOrdersForUser(user.orderUserId, token)
      .then((orderList) => {
        const purchased = new Set<number>()
        orderList
          .filter((o) => ['PAID', 'SHIPPED', 'COMPLETED'].includes(o.status))
          .forEach((o) => o.items.forEach((it) => purchased.add(it.productId)))
        setPurchasedProductIds([...purchased])
      })
      .catch(() => setPurchasedProductIds([]))
  }, [user?.orderUserId, token])

  useEffect(() => {
    if (screen !== 'orders') return
    const userId = user?.orderUserId ?? 1
    setOrdersLoading(true)
    getOrdersForUser(userId, token)
      .then((orderList) => {
        setOrders(orderList)
        const ids = [...new Set(orderList.flatMap((o) => o.items.map((i) => i.productId)))]
        if (ids.length > 0) {
          fetchProducts({ ids, limit: 300 })
            .then((prods) => {
              const map: Record<number, string> = {}
              prods.forEach((p) => { map[p.id] = p.name })
              setOrderProductNames(map)
            })
            .catch(() => {})
        } else {
          setOrderProductNames({})
        }
      })
      .finally(() => setOrdersLoading(false))
  }, [screen, user?.orderUserId, token])

  useEffect(() => {
    if (selectedProductId == null) {
      setProductDetail(null)
      setRelatedProducts([])
      setProductReviews([])
      setReviewHasMore(false)
      setReviewTotalCount(0)
      return
    }
    setProductDetailLoading(true)
    fetchProduct(selectedProductId)
      .then((p) => {
        setProductDetail(p)
        loadProductReviewsPage(p.id, false)
        return fetchRecommendations({ product_id: p.id, wishlist_ids: wishlistIds, limit: 4 })
      })
      .then(setRelatedProducts)
      .catch(() => setProductDetail(null))
      .finally(() => setProductDetailLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadProductReviewsPage is recreated each render; sort changes have a dedicated effect
  }, [selectedProductId, wishlistIds])

  useEffect(() => {
    if (!selectedProductId) return
    loadProductReviewsPage(selectedProductId, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh reviews when sort changes
  }, [reviewSort])

  useEffect(() => {
    if (screen !== 'notifications') return
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [screen])

  async function loadAdminProducts() {
    setAdminProductsLoading(true)
    try {
      const data = await fetchProductsPage({
        skip: (adminProductsPage - 1) * ADMIN_PAGE_SIZE,
        limit: ADMIN_PAGE_SIZE,
      })
      setAdminProducts(data.items)
      setAdminProductsTotal(data.total)
    } finally {
      setAdminProductsLoading(false)
    }
  }

  async function loadAdminUsers() {
    setAdminUsersLoading(true)
    try {
      const data = await adminListUsers(token ?? null, {
        q: adminUsersQuery,
        skip: (adminUsersPage - 1) * ADMIN_PAGE_SIZE,
        limit: ADMIN_PAGE_SIZE,
      })
      setAdminUsers(data.items)
      setAdminUsersTotal(data.total)
    } finally {
      setAdminUsersLoading(false)
    }
  }

  async function loadAdminReviews() {
    setAdminReviewsLoading(true)
    try {
      const data = await adminListReviews(token ?? null, {
        q: adminReviewsQuery,
        skip: (adminReviewsPage - 1) * ADMIN_PAGE_SIZE,
        limit: ADMIN_PAGE_SIZE,
      })
      setAdminReviews(data.items)
      setAdminReviewsTotal(data.total)
    } finally {
      setAdminReviewsLoading(false)
    }
  }

  async function loadAdminPromotions() {
    setAdminPromotionsLoading(true)
    try {
      const data = await adminListPromotions(token ?? null)
      setAdminPromotions(data)
    } finally {
      setAdminPromotionsLoading(false)
    }
  }

  async function loadAdminOrders() {
    if (!token) return
    setAllOrdersLoading(true)
    try {
      const data = await getAllOrders(token, {
        skip: (adminOrdersPage - 1) * ADMIN_PAGE_SIZE,
        limit: ADMIN_PAGE_SIZE,
      })
      setAllOrders(data.items)
      setAdminOrdersTotal(data.total)
    } catch {
      setAllOrders([])
      setAdminOrdersTotal(0)
    } finally {
      setAllOrdersLoading(false)
    }
  }

  async function loadOpsOverview() {
    try {
      const data = await adminOpsOverview(token ?? null)
      setOpsOverview(data)
    } catch {
      setOpsOverview(null)
    }
  }

  async function loadOrderAnalytics(days: number) {
    setOrderAnalyticsLoading(true)
    try {
      const data = await adminOrderAnalytics(token ?? null, { days })
      setOrderAnalytics(data)
    } catch {
      setOrderAnalytics(null)
    } finally {
      setOrderAnalyticsLoading(false)
    }
  }

  async function loadAdminAuditLogs() {
    setAdminAuditLoading(true)
    try {
      const logs = await adminAuditLogs(token ?? null, {
        q: adminAuditQuery,
        skip: (adminAuditPage - 1) * AUDIT_PAGE_SIZE,
        limit: AUDIT_PAGE_SIZE,
      })
      setAdminAuditEntries(logs.items)
      setAdminAuditTotal(logs.total)
    } finally {
      setAdminAuditLoading(false)
    }
  }

  useEffect(() => {
    if (screen !== 'admin') return
    loadAdminProducts()
    fetchCategories().then(setCategories).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load products when admin page/page changes
  }, [screen, adminProductsPage])

  useEffect(() => {
    if (screen !== 'admin' || !token) return
    if (adminTab === 'orders') {
      loadAdminOrders()
    } else if (adminTab === 'users') {
      loadAdminUsers()
    } else if (adminTab === 'reviews') {
      loadAdminReviews()
    } else if (adminTab === 'promotions') {
      loadAdminPromotions()
    } else if (adminTab === 'analytics') {
      loadOrderAnalytics(orderAnalyticsWindow)
    } else if (adminTab === 'ops') {
      loadOpsOverview()
      loadAdminAuditLogs()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load functions are recreated each render; intentionally re-run only on filter/tab changes
  }, [
    screen,
    adminTab,
    token,
    adminOrdersPage,
    adminUsersQuery,
    adminUsersPage,
    adminReviewsQuery,
    adminReviewsPage,
    adminAuditQuery,
    adminAuditPage,
    orderAnalyticsWindow,
  ])

  function openAdminForm(product?: Product) {
    if (product) {
      setAdminFormOpen(product.id)
      setAdminFormData({
        name: product.name,
        description: product.description ?? '',
        category: product.category ?? '',
        price: String(product.price),
        stock: String(product.stock),
        image_url: product.image_url ?? '',
      })
    } else {
      setAdminFormOpen('create')
      setAdminFormData({ name: '', description: '', category: '', price: '', stock: '0', image_url: '' })
    }
  }

  async function handleAdminSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const payload = {
      name: adminFormData.name.trim(),
      description: adminFormData.description.trim() || null,
      category: adminFormData.category.trim() || null,
      price: Number(adminFormData.price),
      stock: Number(adminFormData.stock),
      image_url: adminFormData.image_url?.trim() || null,
    }
    if (payload.name === '' || Number.isNaN(payload.price) || payload.stock < 0) return
    setAdminFormSaving(true)
    try {
      if (adminFormOpen === 'create') {
        await createProduct(payload as ProductCreatePayload, token)
      } else if (typeof adminFormOpen === 'number') {
        await updateProduct(adminFormOpen, payload as ProductUpdatePayload, token)
      }
      setAdminFormOpen(null)
      await loadAdminProducts()
    } finally {
      setAdminFormSaving(false)
    }
  }

  async function handleAdminDelete(id: number) {
    if (!window.confirm('Delete this product?')) return
    try {
      await deleteProduct(id, token)
      await loadAdminProducts()
      if (adminFormOpen === id) setAdminFormOpen(null)
    } catch {
      // ignore
    }
  }

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const email = String(formData.get('email') || '')
    const password = String(formData.get('password') || '')
    await login(email, password)
    pushNotification(`Welcome back, ${email}.`, 'account')
    setScreen('catalog')
  }

  async function handleRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const name = String(formData.get('name') || '')
    const email = String(formData.get('email') || '')
    const password = String(formData.get('password') || '')
    await register(name, email, password)
    pushNotification(`Account created. Welcome, ${name}.`, 'account')
    setScreen('catalog')
  }

  async function handleCheckout() {
    if (!user || items.length === 0) return
    setCheckoutLoading(true)
    try {
      const order = await createOrder(user.orderUserId ?? 1, items, token, couponCode, shippingAddress)
      try {
        const intent = await createPaymentIntent(order.id, token ?? null)
        await confirmPayment(order.id, intent.paymentReference, token ?? null)
      } catch {
        // leave order as pending/requires payment when payment simulation fails
      }
      clearCart()
      setCouponCode('')
      setShippingAddress('')
      const discount = Number(order?.discountAmount || 0)
      setCheckoutMessage(
        discount > 0
          ? `Order placed successfully! Discount applied: $${discount.toFixed(2)}.`
          : 'Order placed successfully!'
      )
      pushNotification(`Order #${order.id} placed successfully.`, 'orders')
      setCartOpen(false)
      setTimeout(() => setCheckoutMessage(null), 2500)
    } catch (err) {
      setCheckoutMessage(null)
      setApiError(getApiErrorMessage(err, 'Checkout failed'))
    } finally {
      setCheckoutLoading(false)
    }
  }

  async function handleProfileSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user) return
    const formData = new FormData(e.currentTarget)
    const name = String(formData.get('name') || '').trim()
    const email = String(formData.get('email') || '').trim()
    if (!name || !email) return
    setProfileSaving(true)
    setProfileMessage(null)
    try {
      await updateProfile({ name, email })
      setProfileMessage('Profile updated.')
      pushNotification('Profile details updated.', 'account')
      setTimeout(() => setProfileMessage(null), 3000)
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Update failed')
      setProfileMessage(msg)
      setApiError(msg)
    } finally {
      setProfileSaving(false)
    }
  }

  async function toggleWishlist(productId: number) {
    if (!token) {
      setApiError('Sign in to use wishlist')
      return
    }
    try {
      const ids = wishlistIds.includes(productId)
        ? await removeWishlistItem(token, productId)
        : await addWishlistItem(token, productId)
      setWishlistIds(ids)
      pushNotification(
        wishlistIds.includes(productId)
          ? 'Removed item from wishlist.'
          : 'Added item to wishlist.',
        'wishlist'
      )
    } catch {
      setApiError('Wishlist update failed')
    }
  }

  async function handleSubmitReview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!productDetail || !user) {
      setApiError('Sign in to leave a review')
      return
    }
    setReviewSubmitting(true)
    try {
      if (reviewEditingId != null) {
        const updated = await updateProductReview(productDetail.id, reviewEditingId, {
          author_name: user.name,
          rating: reviewRating,
          comment: reviewComment.trim() || null,
        })
        setProductReviews((prev) => prev.map((r) => (r.id === reviewEditingId ? updated : r)))
      } else {
        const created = await createProductReview(productDetail.id, {
          author_name: user.name,
          rating: reviewRating,
          comment: reviewComment.trim() || null,
          verified_purchase: purchasedProductIds.includes(productDetail.id),
        })
        setProductReviews((prev) => [created, ...prev])
      }
      setReviewComment('')
      setReviewRating(5)
      setReviewEditingId(null)
      pushNotification(`Thanks for rating ${productDetail.name}.`, 'reviews')
      const refreshed = await fetchProduct(productDetail.id)
      setProductDetail(refreshed)
      await loadProductReviewsPage(productDetail.id, false)
    } catch {
      setApiError('Could not submit your review')
    } finally {
      setReviewSubmitting(false)
    }
  }

  async function handleDeleteReview(reviewId: number) {
    if (!productDetail || !user) return
    if (!window.confirm('Delete this review?')) return
    try {
      await deleteProductReview(productDetail.id, reviewId, user.name)
      setProductReviews((prev) => prev.filter((r) => r.id !== reviewId))
      setReviewEditingId(null)
      pushNotification('Review deleted.', 'reviews')
      const refreshed = await fetchProduct(productDetail.id)
      setProductDetail(refreshed)
      await loadProductReviewsPage(productDetail.id, false)
    } catch {
      setApiError('Could not delete review')
    }
  }

  async function handleAdminUserPatch(
    userId: string,
    payload: Partial<Pick<AdminUser, 'role' | 'isActive' | 'name' | 'email'>>,
  ) {
    try {
      const updated = await adminUpdateUser(userId, payload, token ?? null)
      setAdminUsers((prev) => prev.map((u) => (u._id === userId ? updated : u)))
    } catch {
      setApiError('Failed to update user')
    }
  }

  async function handleAdminUserDelete(userId: string) {
    if (!window.confirm('Delete this user account?')) return
    try {
      await adminDeleteUser(userId, token ?? null)
      setAdminUsers((prev) => prev.filter((u) => u._id !== userId))
    } catch {
      setApiError('Failed to delete user')
    }
  }

  async function handleAdminReviewDelete(reviewId: number) {
    if (!window.confirm('Delete this review?')) return
    try {
      await adminDeleteReview(reviewId, token ?? null)
      setAdminReviews((prev) => prev.filter((r) => r.id !== reviewId))
    } catch {
      setApiError('Failed to delete review')
    }
  }

  async function handleAdminReviewSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!adminReviewEdit) return
    try {
      const updated = await adminUpdateReview(
        adminReviewEdit.product_id,
        adminReviewEdit.id,
        {
          author_name: adminReviewEdit.author_name,
          rating: adminReviewEdit.rating,
          comment: adminReviewEdit.comment,
        },
        token ?? null
      )
      setAdminReviews((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      setAdminReviewEdit(null)
    } catch {
      setApiError('Failed to update review')
    }
  }

  async function handleAdminPromotionCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await adminCreatePromotion(
        {
          code: newPromotion.code,
          percentOff: Number(newPromotion.percentOff) / 100,
          minBasketAmount: Number(newPromotion.minBasketAmount || 0),
          maxUses: newPromotion.maxUses ? Number(newPromotion.maxUses) : null,
          expiresAt: newPromotion.expiresAt ? new Date(newPromotion.expiresAt).toISOString() : null,
          categoryScope: newPromotion.categoryScope || null,
          active: true,
        },
        token ?? null
      )
      setNewPromotion({
        code: '',
        percentOff: '10',
        minBasketAmount: '0',
        maxUses: '',
        expiresAt: '',
        categoryScope: '',
      })
      await loadAdminPromotions()
    } catch {
      setApiError('Failed to create promotion')
    }
  }

  async function handleAdminShipment(order: OrderResponse) {
    const draft = shipmentDrafts[order.id] || { trackingId: '', status: 'SHIPPED' as const }
    if (!draft.trackingId.trim()) {
      setApiError('Tracking ID is required')
      return
    }
    try {
      const updated = await adminUpdateShipment(
        order.id,
        { trackingId: draft.trackingId.trim(), status: draft.status },
        token ?? null
      )
      setAllOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)))
    } catch {
      setApiError('Failed to update shipment')
    }
  }

  async function handleMarkReviewHelpful(reviewId: number) {
    if (!productDetail) return
    setReviewHelpfulBusyId(reviewId)
    try {
      const updated = await markReviewHelpful(productDetail.id, reviewId)
      setProductReviews((prev) => prev.map((r) => (r.id === reviewId ? updated : r)))
    } catch (err) {
      const msg = (err as ApiErrorShape | undefined)?.response?.data?.detail
      setApiError(msg === 'You already marked this review as helpful' ? msg : 'Could not mark review as helpful')
      await loadProductReviewsPage(productDetail.id, false)
    } finally {
      setReviewHelpfulBusyId(null)
    }
  }

  useEffect(() => {
    if (!apiError) return
    const t = setTimeout(() => setApiError(null), 5000)
    return () => clearTimeout(t)
  }, [apiError])

  return (
    <div className="app-shell">
      {apiError && (
        <div className="toast-error" role="alert">
          {apiError}
          <button type="button" onClick={() => setApiError(null)} aria-label="Dismiss">×</button>
        </div>
      )}
      <div className="hero-bg" />
      <header className="app-header">
        <div className="logo-stack">
          <div className="logo-glow">MultiShop</div>
          <div className="logo-sub">microservices commerce</div>
        </div>
        <div className="app-context-pill">{currentScreenLabel[screen]}</div>
        <nav className="nav-links">
          <button className={screen === 'landing' ? 'is-active' : ''} onClick={() => setScreen('landing')}>
            <span className="nav-dot" /> Home
          </button>
          <button className={screen === 'catalog' ? 'is-active' : ''} onClick={() => setScreen('catalog')}>
            <span className="nav-dot" /> Explore
          </button>
          {user ? (
            <>
              <span className="user-pill">Hi, {user.name}</span>
              <button className={screen === 'orders' ? 'is-active' : ''} onClick={() => setScreen('orders')}>
                <span className="nav-dot" /> My orders
              </button>
              <button className={screen === 'profile' ? 'is-active' : ''} onClick={() => setScreen('profile')}>
                <span className="nav-dot" /> Profile
              </button>
              <button className={screen === 'wishlist' ? 'is-active' : ''} onClick={() => setScreen('wishlist')}>
                <span className="nav-dot" /> Wishlist
              </button>
              <button className={screen === 'notifications' ? 'is-active' : ''} onClick={() => setScreen('notifications')}>
                <span className="nav-dot" /> Notifications {unreadNotifications > 0 ? `(${unreadNotifications})` : ''}
              </button>
              {user.role === 'admin' && (
                <button className={screen === 'admin' ? 'is-active' : ''} onClick={() => setScreen('admin')}>
                  <span className="nav-dot" /> Admin
                </button>
              )}
              <button onClick={logout}>Logout</button>
            </>
          ) : (
            <button className={screen === 'auth' ? 'is-active' : ''} onClick={() => setScreen('auth')}>
              <span className="nav-dot" /> Sign in
            </button>
          )}
        </nav>
      </header>

      <main className="app-main">
        <AnimatePresence mode="wait">
          {screen === 'landing' && (
            <motion.section
              key="landing"
              className="landing-v2"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            >
              <div className="landing-v2-bg">
                <motion.div
                  className="landing-v2-blob blob-a"
                  animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
                  transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
                />
                <motion.div
                  className="landing-v2-blob blob-b"
                  animate={{ scale: [1.2, 1, 1.2], rotate: [360, 180, 0] }}
                  transition={{ duration: 26, repeat: Infinity, ease: 'linear' }}
                />
                <motion.div
                  className="landing-v2-blob blob-c"
                  animate={{ scale: [1, 1.3, 1], x: [0, 100, 0], y: [0, -80, 0] }}
                  transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
                />
              </div>

              <div className="landing-v2-hero">
                <motion.span
                  className="landing-v2-badge"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  New architecture-driven storefront
                </motion.span>
                <motion.h1
                  className="landing-v2-title"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  Elevate your commerce with <span className="accent">microservices at scale</span>
                </motion.h1>
                <motion.p
                  className="landing-v2-subtitle"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  A modern e-commerce platform powered by Node.js auth, FastAPI products, Spring Boot
                  orders, and a secure API gateway, wrapped in an animated React experience.
                </motion.p>
                <motion.div
                  className="landing-v2-actions"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <motion.button
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    className="btn-primary"
                    onClick={() => setScreen('catalog')}
                  >
                    Shop now
                  </motion.button>
                  {!user && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      className="btn-ghost"
                      onClick={() => setScreen('auth')}
                    >
                      Sign in
                    </motion.button>
                  )}
                </motion.div>

                <div className="landing-v2-stats">
                  {[
                    { value: '3', label: 'Core Services' },
                    { value: '5+', label: 'Tech Stacks' },
                    { value: `${products?.length ?? 0}`, label: 'Products Live' },
                  ].map((stat, index) => (
                    <motion.div
                      key={stat.label}
                      className="landing-v2-stat"
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + index * 0.07 }}
                    >
                      <div className="landing-v2-stat-value">{stat.value}</div>
                      <div className="landing-v2-stat-label">{stat.label}</div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <section className="landing-v2-featured">
                <div className="landing-v2-featured-head">
                  <h2>Featured products</h2>
                  <button type="button" className="btn-ghost" onClick={() => setScreen('catalog')}>
                    View catalog
                  </button>
                </div>
                <div className="landing-v2-grid">
                  {(products ?? []).slice(0, 8).map((p, idx) => (
                    <motion.article
                      key={p.id}
                      className="landing-v2-card"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 * idx }}
                      whileHover={{ y: -4, boxShadow: '0 18px 50px rgba(15, 23, 42, 0.8)' }}
                    >
                      <div className="landing-v2-card-img-wrap" onClick={() => openProduct(p.id)}>
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="landing-v2-card-img" />
                        ) : (
                          <div className="landing-v2-card-placeholder">{p.category ?? 'Product'}</div>
                        )}
                      </div>
                      <div className="landing-v2-card-body">
                        <div className="landing-v2-card-title-row">
                          <h3>{p.name}</h3>
                          <span>${p.price.toFixed(2)}</span>
                        </div>
                        <p>{p.description || 'Premium product ready for checkout.'}</p>
                        <div className="landing-v2-card-meta">
                          <span>{p.category || 'General'}</span>
                          <span>{p.stock} in stock</span>
                          <span>{p.rating_count ? `★ ${p.rating_avg?.toFixed(1)} (${p.rating_count})` : 'No ratings yet'}</span>
                        </div>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => {
                            addToCart(p)
                            setCartOpen(true)
                          }}
                        >
                          Add to cart
                        </button>
                      </div>
                    </motion.article>
                  ))}
                  {!productsLoading && (!products || products.length === 0) && (
                    <p className="catalog-empty">No products yet. Open catalog and add the first one.</p>
                  )}
                </div>
              </section>
              <section className="landing-v2-featured">
                <div className="landing-v2-featured-head">
                  <h2>Recommended for you</h2>
                </div>
                {recommendedProducts.length === 0 ? (
                  <p className="catalog-empty">Recommendations will appear as you browse and save products.</p>
                ) : (
                  <div className="landing-v2-grid">
                    {recommendedProducts.map((p) => (
                      <motion.article
                        key={`rec-${p.id}`}
                        className="landing-v2-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ y: -4, boxShadow: '0 18px 50px rgba(15, 23, 42, 0.8)' }}
                      >
                        <div className="landing-v2-card-img-wrap" onClick={() => openProduct(p.id)}>
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="landing-v2-card-img" />
                          ) : (
                            <div className="landing-v2-card-placeholder">{p.category ?? 'Product'}</div>
                          )}
                        </div>
                        <div className="landing-v2-card-body">
                          <div className="landing-v2-card-title-row">
                            <h3>{p.name}</h3>
                            <span>${p.price.toFixed(2)}</span>
                          </div>
                          <div className="landing-v2-card-meta">
                            <span>{p.category || 'General'}</span>
                            <span>{p.stock} in stock</span>
                            <span>{p.rating_count ? `★ ${p.rating_avg?.toFixed(1)} (${p.rating_count})` : 'No ratings yet'}</span>
                          </div>
                        </div>
                      </motion.article>
                    ))}
                  </div>
                )}
              </section>
              <section className="landing-v2-featured">
                <div className="landing-v2-featured-head">
                  <h2>Recently viewed</h2>
                </div>
                {recentlyViewedProducts.length === 0 ? (
                  <p className="catalog-empty">Open products to build your personalized home feed.</p>
                ) : (
                  <div className="landing-v2-grid">
                    {recentlyViewedProducts.slice(0, 8).map((p) => (
                      <article key={`recent-${p.id}`} className="landing-v2-card">
                        <div className="landing-v2-card-img-wrap" onClick={() => openProduct(p.id)}>
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="landing-v2-card-img" />
                          ) : (
                            <div className="landing-v2-card-placeholder">{p.category ?? 'Product'}</div>
                          )}
                        </div>
                        <div className="landing-v2-card-body">
                          <div className="landing-v2-card-title-row">
                            <h3>{p.name}</h3>
                            <span>${p.price.toFixed(2)}</span>
                          </div>
                          <div className="landing-v2-card-meta">
                            <span>{p.category || 'General'}</span>
                            <span>{p.rating_count ? `★ ${p.rating_avg?.toFixed(1)}` : 'No ratings yet'}</span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </motion.section>
          )}

          {screen === 'auth' && (
            <motion.section
              key="auth"
              className="panel auth-panel"
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              transition={{ duration: 0.35 }}
            >
              <div className="auth-header">
                <h2>{authMode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
                <p>
                  {authMode === 'login'
                    ? 'Sign in with the credentials stored in the Node.js user service.'
                    : 'Register a new account powered by the Node.js user service.'}
                </p>
              </div>

              <div className="auth-tabs">
                <button
                  type="button"
                  className={authMode === 'login' ? 'active' : ''}
                  onClick={() => setAuthMode('login')}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={authMode === 'register' ? 'active' : ''}
                  onClick={() => setAuthMode('register')}
                >
                  Register
                </button>
              </div>

              <AnimatePresence mode="wait">
                {authMode === 'login' ? (
                  <motion.form
                    key="login-form"
                    className="auth-form"
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.3 }}
                    onSubmit={handleLogin}
                  >
                    <label className="field">
                      <span>Email</span>
                      <input name="email" type="email" placeholder="you@example.com" required />
                    </label>
                    <label className="field">
                      <span>Password</span>
                      <input name="password" type="password" placeholder="••••••••" autoComplete="current-password" required />
                    </label>
                    <motion.button
                      type="submit"
                      className="btn-primary full"
                      whileHover={{ scale: loading ? 1 : 1.02, y: loading ? 0 : -1 }}
                      whileTap={{ scale: 0.97 }}
                      disabled={loading}
                    >
                      {loading ? 'Signing in…' : 'Sign in'}
                    </motion.button>
                  </motion.form>
                ) : (
                  <motion.form
                    key="register-form"
                    className="auth-form"
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.3 }}
                    onSubmit={handleRegister}
                  >
                    <label className="field">
                      <span>Name</span>
                      <input name="name" type="text" placeholder="Jane Doe" required />
                    </label>
                    <label className="field">
                      <span>Email</span>
                      <input name="email" type="email" placeholder="you@example.com" required />
                    </label>
                    <label className="field">
                      <span>Password</span>
                      <input name="password" type="password" placeholder="Choose a strong password" autoComplete="new-password" required />
                    </label>
                    <motion.button
                      type="submit"
                      className="btn-primary full"
                      whileHover={{ scale: loading ? 1 : 1.02, y: loading ? 0 : -1 }}
                      whileTap={{ scale: 0.97 }}
                      disabled={loading}
                    >
                      {loading ? 'Creating account…' : 'Create account'}
                    </motion.button>
                  </motion.form>
                )}
              </AnimatePresence>
            </motion.section>
          )}

          {screen === 'catalog' && (
            <>
              <motion.section
                key="catalog"
                className="panel catalog-panel"
                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 20 }}
                transition={{ duration: 0.35 }}
              >
                <div className="catalog-header">
                  <h2>Products</h2>
                  <p>Served by the FastAPI product service through the TypeScript gateway.</p>
                </div>
                <motion.div
                  className="catalog-filters"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <input
                    type="text"
                    className="filter-input"
                    placeholder="Search by name or description…"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setProductPage(1)
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && loadProducts(productPage)}
                  />
                  <select
                    className="filter-input filter-select"
                    value={categoryFilter}
                    onChange={(e) => {
                      setCategoryFilter(e.target.value)
                      setProductPage(1)
                    }}
                  >
                    <option value="">All categories</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="filter-input filter-input--num"
                    placeholder="Min price"
                    min={0}
                    step={0.01}
                    value={minPrice}
                    onChange={(e) => {
                      setMinPrice(e.target.value)
                      setProductPage(1)
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && loadProducts(productPage)}
                  />
                  <input
                    type="number"
                    className="filter-input filter-input--num"
                    placeholder="Max price"
                    min={0}
                    step={0.01}
                    value={maxPrice}
                    onChange={(e) => {
                      setMaxPrice(e.target.value)
                      setProductPage(1)
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && loadProducts(productPage)}
                  />
                  <label className="filter-check">
                    <input
                      type="checkbox"
                      checked={inStockOnly}
                      onChange={(e) => {
                        setInStockOnly(e.target.checked)
                        setProductPage(1)
                      }}
                    />
                    <span>In stock only</span>
                  </label>
                  <div className="filter-actions">
                    <motion.button
                      type="button"
                      className="btn-primary"
                      whileHover={{ scale: 1.02, y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => loadProducts(productPage)}
                      disabled={productsLoading}
                    >
                      {productsLoading ? 'Searching…' : 'Search'}
                    </motion.button>
                    <motion.button
                      type="button"
                      className="btn-secondary"
                      whileHover={{ scale: 1.02, y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setSearchQuery('')
                        setCategoryFilter('')
                        setMinPrice('')
                        setMaxPrice('')
                        setInStockOnly(false)
                        setProductPage(1)
                      }}
                    >
                      Clear
                    </motion.button>
                  </div>
                </motion.div>
                <div className="catalog-grid">
                  {productsLoading && (
                    <>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="product-card skeleton" />
                      ))}
                    </>
                  )}
                  {!productsLoading && products?.length === 0 && (
                    <motion.p
                      className="catalog-empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      No products match your filters. Try different criteria or clear filters.
                    </motion.p>
                  )}
                  {!productsLoading &&
                    (products?.length ?? 0) > 0 &&
                    products?.map((p) => (
                      <motion.article
                        key={p.id}
                        className="product-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        whileHover={{ y: -4, boxShadow: '0 18px 50px rgba(15,23,42,0.8)' }}
                      >
                        <div
                          className="product-card-clickable"
                          onClick={() => openProduct(p.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && openProduct(p.id)}
                        >
                          {p.image_url && (
                            <img src={p.image_url} alt="" className="product-card-img" />
                          )}
                          <div className="product-title-row">
                            <h3>{p.name}</h3>
                            <span className="product-price">${p.price.toFixed(2)}</span>
                          </div>
                          {p.description && <p className="product-desc">{p.description}</p>}
                          <div className="product-meta">
                            {p.category && <span className="badge">{p.category}</span>}
                            <span className="badge subtle">{p.stock} in stock</span>
                            <span className="badge subtle">{p.rating_count ? `★ ${p.rating_avg?.toFixed(1)} (${p.rating_count})` : 'No ratings'}</span>
                          </div>
                        </div>
                        <div className="product-card-actions">
                          <motion.button
                            className="btn-secondary"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => toggleWishlist(p.id)}
                          >
                            {wishlistIds.includes(p.id) ? 'Saved' : 'Save'}
                          </motion.button>
                          <motion.button
                            className="btn-ghost"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => openProduct(p.id)}
                          >
                            View
                          </motion.button>
                          <motion.button
                            className="btn-primary"
                            whileHover={{ scale: 1.02, y: -1 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => {
                              addToCart(p)
                              setCartOpen(true)
                            }}
                          >
                            Add to cart
                          </motion.button>
                        </div>
                      </motion.article>
                    ))}
                </div>
                <PaginationControls
                  page={productPage}
                  pageSize={CATALOG_PAGE_SIZE}
                  total={productTotal}
                  loading={productsLoading}
                  onPageChange={setProductPage}
                />
                {checkoutMessage && <div className="toast-success">{checkoutMessage}</div>}
              </motion.section>

              <motion.button
                className="cart-fab"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setCartOpen((v) => !v)}
              >
                Cart ({items.length})
              </motion.button>

              <AnimatePresence>
                {cartOpen && (
                  <motion.aside
                    key="cart"
                    className="cart-panel"
                    initial={{ x: 320, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 320, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                  >
                    <div className="cart-header">
                      <h3>Your cart</h3>
                      <button onClick={() => setCartOpen(false)}>Close</button>
                    </div>
                    {items.length === 0 ? (
                      <p className="cart-empty">No items yet. Add something from the catalog.</p>
                    ) : (
                      <>
                        <ul className="cart-list">
                          {items.map((item) => (
                            <li key={item.product.id} className="cart-item">
                              <div>
                                <div className="cart-item-name">{item.product.name}</div>
                                <div className="cart-item-meta">
                                  {item.quantity} × ${item.product.price.toFixed(2)}
                                </div>
                              </div>
                              <button onClick={() => removeFromCart(item.product.id)}>Remove</button>
                            </li>
                          ))}
                        </ul>
                        <div className="cart-footer">
                          <div className="cart-total">Total: ${total.toFixed(2)}</div>
                          <label className="field">
                            <span>Promo code (optional)</span>
                            <input
                              type="text"
                              placeholder="WELCOME10 / SAVE20 / VIP30"
                              value={couponCode}
                              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                            />
                          </label>
                          <label className="field">
                            <span>Shipping address</span>
                            <input
                              type="text"
                              placeholder="Street, city, country"
                              value={shippingAddress}
                              onChange={(e) => setShippingAddress(e.target.value)}
                            />
                          </label>
                          <motion.button
                            className="btn-primary full"
                            whileHover={{ scale: checkoutLoading ? 1 : 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            disabled={checkoutLoading || !user || items.length === 0}
                            onClick={handleCheckout}
                          >
                            {checkoutLoading ? 'Placing order…' : user ? 'Checkout' : 'Sign in to checkout'}
                          </motion.button>
                        </div>
                      </>
                    )}
                  </motion.aside>
                )}
              </AnimatePresence>
            </>
          )}

          {screen === 'wishlist' && (
            <motion.section
              key="wishlist"
              className="panel catalog-panel"
              initial={{ opacity: 0, scale: 0.98, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -20 }}
              transition={{ duration: 0.35 }}
            >
              <div className="catalog-header">
                <h2>My wishlist</h2>
                <p>Products you saved for later.</p>
              </div>
              {wishlistProducts.length === 0 ? (
                <p className="catalog-empty">No saved products yet.</p>
              ) : (
                <div className="catalog-grid">
                  {wishlistProducts.map((p) => (
                    <motion.article
                      key={p.id}
                      className="product-card"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ y: -4, boxShadow: '0 18px 50px rgba(15,23,42,0.8)' }}
                    >
                      <div className="product-card-clickable" onClick={() => openProduct(p.id)} role="button" tabIndex={0}>
                        {p.image_url && <img src={p.image_url} alt="" className="product-card-img" />}
                        <div className="product-title-row">
                          <h3>{p.name}</h3>
                          <span className="product-price">${p.price.toFixed(2)}</span>
                        </div>
                        {p.description && <p className="product-desc">{p.description}</p>}
                      </div>
                      <div className="product-card-actions">
                        <button className="btn-secondary" type="button" onClick={() => toggleWishlist(p.id)}>Remove</button>
                        <button
                          className="btn-primary"
                          type="button"
                          onClick={() => {
                            addToCart(p)
                            setCartOpen(true)
                          }}
                        >
                          Add to cart
                        </button>
                      </div>
                    </motion.article>
                  ))}
                </div>
              )}
            </motion.section>
          )}

          {screen === 'notifications' && (
            <motion.section
              key="notifications"
              className="panel catalog-panel"
              initial={{ opacity: 0, scale: 0.98, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -20 }}
              transition={{ duration: 0.35 }}
            >
              <div className="catalog-header">
                <h2>Notification center</h2>
                <p>Your in-app updates from shopping and account activity.</p>
              </div>
              <div className="notification-filters">
                {(['all', 'orders', 'wishlist', 'reviews', 'account'] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className={notificationFilter === kind ? 'is-active' : ''}
                    onClick={() => setNotificationFilter(kind)}
                  >
                    {kind}
                    {kind === 'all'
                      ? unreadNotifications > 0 ? ` (${unreadNotifications})` : ''
                      : unreadByKind[kind] > 0 ? ` (${unreadByKind[kind]})` : ''}
                  </button>
                ))}
              </div>
              <div className="notification-actions">
                <button type="button" className="btn-ghost" onClick={() => clearNotifications('filtered')}>
                  Clear filtered
                </button>
                <button type="button" className="btn-danger" onClick={() => clearNotifications('all')}>
                  Clear all
                </button>
              </div>
              {filteredNotifications.length === 0 ? (
                <p className="catalog-empty">No notifications yet.</p>
              ) : (
                <div className="review-list">
                  {filteredNotifications.map((note) => (
                    <div key={note.id} className={`review-item ${note.read ? 'is-read' : ''}`}>
                      <div>
                        <strong>{note.message}</strong>
                      </div>
                      <div>
                        <span className="badge subtle">{note.kind}</span> · {new Date(note.createdAt).toLocaleString()}
                      </div>
                      {!note.read && (
                        <div className="review-actions">
                          <button type="button" className="btn-secondary" onClick={() => markNotificationRead(note.id)}>
                            Mark as read
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.section>
          )}

          {screen === 'orders' && (
            <motion.section
              key="orders"
              className="panel catalog-panel"
              initial={{ opacity: 0, scale: 0.98, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -20 }}
              transition={{ duration: 0.35 }}
            >
              <div className="catalog-header">
                <h2>My orders</h2>
                <p>Orders placed through the Java order service.</p>
              </div>
              {ordersLoading && (
                <div className="orders-loading">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="product-card skeleton" />
                  ))}
                </div>
              )}
              {!ordersLoading && (!orders || orders.length === 0) && (
                <motion.p className="catalog-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  No orders yet. Add items from the catalog and checkout.
                </motion.p>
              )}
              {!ordersLoading && orders && orders.length > 0 && (
                <ul className="orders-list">
                  {orders.map((order, idx) => (
                    <motion.li
                      key={order.id}
                      className="order-card"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.06 }}
                    >
                      <div className="order-card-header">
                        <span className="order-id">Order #{order.id}</span>
                        <span className="order-status badge">{order.status}</span>
                      </div>
                      <div className="order-card-meta">
                        <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                        <span className="order-total">${Number(order.totalAmount).toFixed(2)}</span>
                      </div>
                      {(order.couponCode || Number(order.discountAmount || 0) > 0) && (
                        <div className="order-card-meta">
                          {order.couponCode && <span>Coupon: {order.couponCode}</span>}
                          {Number(order.discountAmount || 0) > 0 && (
                            <span className="order-total">Saved ${Number(order.discountAmount).toFixed(2)}</span>
                          )}
                        </div>
                      )}
                      {(order.shippingAddress || order.shipmentTrackingId) && (
                        <div className="order-card-meta">
                          {order.shippingAddress && <span>Ship to: {order.shippingAddress}</span>}
                          {order.shipmentTrackingId && <span>Tracking: {order.shipmentTrackingId}</span>}
                        </div>
                      )}
                      {order.status?.toUpperCase() !== 'CANCELLED' && (
                        <ol className="shipment-timeline" aria-label="Order progress">
                          {buildShipmentSteps(order).map((step, i, arr) => (
                            <li
                              key={step.key}
                              className={
                                'shipment-step' +
                                (step.done ? ' is-done' : '') +
                                (step.active ? ' is-active' : '') +
                                (i === arr.length - 1 ? ' is-last' : '')
                              }
                            >
                              <span className="shipment-step-dot" aria-hidden="true" />
                              <span className="shipment-step-text">
                                <span className="shipment-step-label">{step.label}</span>
                                {step.at && (
                                  <span className="shipment-step-time">
                                    {new Date(step.at).toLocaleString(undefined, {
                                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                                    })}
                                  </span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ol>
                      )}
                      <ul className="order-items-preview">
                        {order.items.slice(0, 4).map((it) => (
                          <li key={it.id}>
                            {it.quantity}× {orderProductNames[it.productId] ?? `Product #${it.productId}`} — ${Number(it.unitPrice).toFixed(2)} each
                          </li>
                        ))}
                        {order.items.length > 4 && (
                          <li className="order-more">+{order.items.length - 4} more</li>
                        )}
                      </ul>
                    </motion.li>
                  ))}
                </ul>
              )}
            </motion.section>
          )}

          {screen === 'admin' && (
            <motion.section
              key="admin"
              className="panel catalog-panel admin-panel"
              initial={{ opacity: 0, scale: 0.98, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -20 }}
              transition={{ duration: 0.35 }}
            >
              <div className="catalog-header admin-header">
                <h2>Admin</h2>
                <div className="admin-tabs">
                  <button
                    type="button"
                    className={adminTab === 'products' ? 'active' : ''}
                    onClick={() => setAdminTab('products')}
                  >
                    Products
                  </button>
                  <button
                    type="button"
                    className={adminTab === 'orders' ? 'active' : ''}
                    onClick={() => setAdminTab('orders')}
                  >
                    Orders
                  </button>
                  <button type="button" className={adminTab === 'users' ? 'active' : ''} onClick={() => setAdminTab('users')}>
                    Users
                  </button>
                  <button type="button" className={adminTab === 'reviews' ? 'active' : ''} onClick={() => setAdminTab('reviews')}>
                    Reviews
                  </button>
                  <button type="button" className={adminTab === 'promotions' ? 'active' : ''} onClick={() => setAdminTab('promotions')}>
                    Promotions
                  </button>
                  <button type="button" className={adminTab === 'analytics' ? 'active' : ''} onClick={() => setAdminTab('analytics')}>
                    Analytics
                  </button>
                  <button type="button" className={adminTab === 'ops' ? 'active' : ''} onClick={() => setAdminTab('ops')}>
                    Ops
                  </button>
                </div>
                {adminTab === 'products' && (
                  <motion.button
                    type="button"
                    className="btn-primary"
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => openAdminForm()}
                  >
                    Add product
                  </motion.button>
                )}
              </div>
              {adminTab === 'orders' && (
                <>
                  {allOrdersLoading && <p className="catalog-empty">Loading orders…</p>}
                  {!allOrdersLoading && allOrders.length === 0 && (
                    <p className="catalog-empty">No orders.</p>
                  )}
                  {!allOrdersLoading && allOrders.length > 0 && (
                    <>
                      <ul className="admin-order-list">
                        {allOrders.map((order) => (
                          <li key={order.id} className="admin-order-row">
                            <div>
                              <span className="order-id">#{order.id}</span>
                              <span>User {order.userId}</span>
                              <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                              <span className="order-total">${Number(order.totalAmount).toFixed(2)}</span>
                              {order.couponCode && <span>Coupon {order.couponCode}</span>}
                            </div>
                            <select
                              value={order.status}
                              onChange={(e) => {
                                const newStatus = e.target.value
                                updateOrderStatus(order.id, newStatus, token)
                                  .then((updated) => setAllOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o))))
                                  .catch(() => {})
                              }}
                            >
                              <option value="PENDING">PENDING</option>
                              <option value="PAID">PAID</option>
                              <option value="SHIPPED">SHIPPED</option>
                              <option value="COMPLETED">COMPLETED</option>
                              <option value="CANCELLED">CANCELLED</option>
                            </select>
                            <div className="admin-product-actions">
                              <input
                                className="filter-input filter-input--short"
                                placeholder="Tracking ID"
                                value={shipmentDrafts[order.id]?.trackingId ?? order.shipmentTrackingId ?? ''}
                                onChange={(e) =>
                                  setShipmentDrafts((prev) => ({
                                    ...prev,
                                    [order.id]: {
                                      trackingId: e.target.value,
                                      status: prev[order.id]?.status ?? 'SHIPPED',
                                    },
                                  }))
                                }
                              />
                              <select
                                value={shipmentDrafts[order.id]?.status ?? 'SHIPPED'}
                                onChange={(e) =>
                                  setShipmentDrafts((prev) => ({
                                    ...prev,
                                    [order.id]: {
                                      trackingId: prev[order.id]?.trackingId ?? order.shipmentTrackingId ?? '',
                                      status: e.target.value as 'SHIPPED' | 'DELIVERED',
                                    },
                                  }))
                                }
                              >
                                <option value="SHIPPED">SHIPPED</option>
                                <option value="DELIVERED">DELIVERED</option>
                              </select>
                              <button type="button" className="btn-secondary" onClick={() => handleAdminShipment(order)}>
                                Update shipment
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <PaginationControls
                        page={adminOrdersPage}
                        pageSize={ADMIN_PAGE_SIZE}
                        total={adminOrdersTotal}
                        loading={allOrdersLoading}
                        onPageChange={setAdminOrdersPage}
                      />
                    </>
                  )}
                </>
              )}
              {adminTab === 'users' && (
                <>
                  <div className="catalog-filters">
                    <input
                      className="filter-input"
                      placeholder="Search users (name/email/role)"
                      value={adminUsersQuery}
                      onChange={(e) => {
                        setAdminUsersQuery(e.target.value)
                        setAdminUsersPage(1)
                      }}
                    />
                  </div>
                  {adminUsersLoading && <p className="catalog-empty">Loading users…</p>}
                  {!adminUsersLoading && (
                    <>
                      <ul className="admin-order-list">
                        {adminUsers.map((u) => (
                          <li key={u._id} className="admin-order-row">
                            <div>
                              <span className="order-id">{u.name}</span>
                              <span>{u.email}</span>
                              <span className="badge subtle">{u.role}</span>
                              <span className="badge subtle">{u.isActive ? 'ACTIVE' : 'DISABLED'}</span>
                            </div>
                            <div className="admin-product-actions">
                              <button
                                type="button"
                                className="btn-ghost"
                                onClick={() => handleAdminUserPatch(u._id, { role: u.role === 'admin' ? 'customer' : 'admin' })}
                              >
                                Toggle role
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleAdminUserPatch(u._id, { isActive: !u.isActive })}
                              >
                                {u.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                              <button type="button" className="btn-danger" onClick={() => handleAdminUserDelete(u._id)}>
                                Delete
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <PaginationControls
                        page={adminUsersPage}
                        pageSize={ADMIN_PAGE_SIZE}
                        total={adminUsersTotal}
                        loading={adminUsersLoading}
                        onPageChange={setAdminUsersPage}
                      />
                    </>
                  )}
                </>
              )}
              {adminTab === 'reviews' && (
                <>
                  <div className="catalog-filters">
                    <input
                      className="filter-input"
                      placeholder="Search reviews (author/comment)"
                      value={adminReviewsQuery}
                      onChange={(e) => {
                        setAdminReviewsQuery(e.target.value)
                        setAdminReviewsPage(1)
                      }}
                    />
                  </div>
                  {adminReviewsLoading && <p className="catalog-empty">Loading reviews…</p>}
                  {!adminReviewsLoading && (
                    <>
                      <ul className="admin-order-list">
                        {adminReviews.map((r) => (
                          <li key={r.id} className="admin-order-row">
                            <div>
                              <span className="order-id">Review #{r.id}</span>
                              <span>Product {r.product_id}</span>
                              <span>{r.author_name}</span>
                              <span>★ {r.rating}</span>
                              {r.comment && <span>{r.comment}</span>}
                            </div>
                            <button type="button" className="btn-danger" onClick={() => handleAdminReviewDelete(r.id)}>
                              Remove
                            </button>
                            <button
                              type="button"
                              className="btn-ghost"
                              onClick={() =>
                                setAdminReviewEdit({
                                  id: r.id,
                                  product_id: r.product_id,
                                  author_name: r.author_name,
                                  rating: r.rating,
                                  comment: r.comment ?? '',
                                })
                              }
                            >
                              Edit
                            </button>
                          </li>
                        ))}
                      </ul>
                      <PaginationControls
                        page={adminReviewsPage}
                        pageSize={ADMIN_PAGE_SIZE}
                        total={adminReviewsTotal}
                        loading={adminReviewsLoading}
                        onPageChange={setAdminReviewsPage}
                      />
                    </>
                  )}
                </>
              )}
              {adminTab === 'promotions' && (
                <>
                  <form className="catalog-filters" onSubmit={handleAdminPromotionCreate}>
                    <input
                      className="filter-input"
                      placeholder="CODE"
                      value={newPromotion.code}
                      onChange={(e) => setNewPromotion((d) => ({ ...d, code: e.target.value.toUpperCase() }))}
                      required
                    />
                    <input
                      className="filter-input filter-input--num"
                      type="number"
                      min={1}
                      max={90}
                      placeholder="% off"
                      value={newPromotion.percentOff}
                      onChange={(e) => setNewPromotion((d) => ({ ...d, percentOff: e.target.value }))}
                    />
                    <input
                      className="filter-input filter-input--num"
                      type="number"
                      min={0}
                      placeholder="Min basket"
                      value={newPromotion.minBasketAmount}
                      onChange={(e) => setNewPromotion((d) => ({ ...d, minBasketAmount: e.target.value }))}
                    />
                    <input
                      className="filter-input filter-input--num"
                      type="number"
                      min={1}
                      placeholder="Max uses"
                      value={newPromotion.maxUses}
                      onChange={(e) => setNewPromotion((d) => ({ ...d, maxUses: e.target.value }))}
                    />
                    <select
                      className="filter-input"
                      value={newPromotion.categoryScope}
                      onChange={(e) => setNewPromotion((d) => ({ ...d, categoryScope: e.target.value }))}
                      title="Limit discount to one product category"
                    >
                      <option value="">All categories</option>
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                    <input
                      className="filter-input"
                      type="datetime-local"
                      value={newPromotion.expiresAt}
                      onChange={(e) => setNewPromotion((d) => ({ ...d, expiresAt: e.target.value }))}
                      title="Optional expiration date"
                    />
                    <button type="submit" className="btn-primary">Create/Update</button>
                  </form>
                  {adminPromotionsLoading && <p className="catalog-empty">Loading promotions…</p>}
                  {!adminPromotionsLoading && (
                    <>
                      <ul className="admin-order-list">
                        {pagedAdminPromotions.map((p) => (
                          <li key={p.code} className="admin-order-row">
                            <div>
                              <span className="order-id">{p.code}</span>
                              <span>{Math.round((p.percentOff || 0) * 100)}% off</span>
                              <span>min ${Number(p.minBasketAmount || 0).toFixed(2)}</span>
                              <span>{p.categoryScope ? `category ${p.categoryScope}` : 'all categories'}</span>
                              <span>uses {p.usedCount}{p.maxUses ? `/${p.maxUses}` : ''}</span>
                              {p.expiresAt && <span>expires {new Date(p.expiresAt).toLocaleDateString()}</span>}
                              <span className="badge subtle">{p.active ? 'ACTIVE' : 'INACTIVE'}</span>
                            </div>
                            <div className="admin-product-actions">
                              <button type="button" className="btn-secondary" onClick={() => adminTogglePromotion(p.code, token ?? null).then(loadAdminPromotions)}>
                                Toggle
                              </button>
                              <button type="button" className="btn-danger" onClick={() => adminDeletePromotion(p.code, token ?? null).then(loadAdminPromotions)}>
                                Delete
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <PaginationControls
                        page={adminPromotionsPage}
                        pageSize={ADMIN_PAGE_SIZE}
                        total={adminPromotions.length}
                        loading={adminPromotionsLoading}
                        onPageChange={setAdminPromotionsPage}
                      />
                    </>
                  )}
                </>
              )}
              {adminTab === 'analytics' && (
                <>
                  <div className="catalog-filters">
                    <span className="filter-input" style={{ display: 'inline-flex', alignItems: 'center' }}>
                      Window:
                    </span>
                    {([7, 14, 30, 90] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={orderAnalyticsWindow === d ? 'btn-secondary active' : 'btn-ghost'}
                        onClick={() => setOrderAnalyticsWindow(d)}
                      >
                        {d}d
                      </button>
                    ))}
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => loadOrderAnalytics(orderAnalyticsWindow)}
                    >
                      Refresh
                    </button>
                  </div>
                  {orderAnalyticsLoading && <p className="catalog-empty">Loading analytics…</p>}
                  {!orderAnalyticsLoading && !orderAnalytics && (
                    <p className="catalog-empty">
                      No analytics yet. Make sure RabbitMQ is running and the order-service is started with the
                      <code> rabbit </code> profile so <code>order.placed</code> events flow into the user-service projection.
                    </p>
                  )}
                  {!orderAnalyticsLoading && orderAnalytics && (
                    <>
                      <div className="analytics-summary">
                        <div className="analytics-card">
                          <span className="analytics-label">Total orders</span>
                          <span className="analytics-value">{orderAnalytics.summary.totalOrders}</span>
                        </div>
                        <div className="analytics-card">
                          <span className="analytics-label">Total revenue</span>
                          <span className="analytics-value">${orderAnalytics.summary.totalRevenue.toFixed(2)}</span>
                        </div>
                        <div className="analytics-card">
                          <span className="analytics-label">Unique buyers</span>
                          <span className="analytics-value">{orderAnalytics.summary.uniqueUsers}</span>
                        </div>
                        <div className="analytics-card">
                          <span className="analytics-label">Avg. order</span>
                          <span className="analytics-value">
                            ${
                              (orderAnalytics.summary.totalOrders > 0
                                ? orderAnalytics.summary.totalRevenue / orderAnalytics.summary.totalOrders
                                : 0).toFixed(2)
                            }
                          </span>
                        </div>
                      </div>

                      <h4 style={{ marginTop: '1.4rem', marginBottom: '0.6rem' }}>
                        Orders per day (last {orderAnalytics.summary.windowDays} days)
                      </h4>
                      {orderAnalytics.daily.length === 0 ? (
                        <p className="catalog-empty">No orders in this window.</p>
                      ) : (
                        <div className="analytics-bars">
                          {(() => {
                            const maxOrders = Math.max(1, ...orderAnalytics.daily.map((d) => d.orders))
                            return orderAnalytics.daily.map((d) => (
                              <div key={d.day} className="analytics-bar-row">
                                <span className="analytics-bar-label">{d.day}</span>
                                <div className="analytics-bar-track">
                                  <div
                                    className="analytics-bar-fill"
                                    style={{ width: `${(d.orders / maxOrders) * 100}%` }}
                                  />
                                </div>
                                <span className="analytics-bar-value">
                                  {d.orders} · ${d.revenue.toFixed(2)}
                                </span>
                              </div>
                            ))
                          })()}
                        </div>
                      )}

                      <h4 style={{ marginTop: '1.4rem', marginBottom: '0.6rem' }}>Top customers</h4>
                      {orderAnalytics.topUsers.length === 0 ? (
                        <p className="catalog-empty">No customer activity yet.</p>
                      ) : (
                        <ul className="review-list">
                          {orderAnalytics.topUsers.map((u) => (
                            <li key={u.orderUserId} className="review-item">
                              <strong>{u.name ?? `User #${u.orderUserId}`}</strong>
                              {u.email && <span> · {u.email}</span>}
                              <span> · {u.orders} orders · ${u.revenue.toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      <h4 style={{ marginTop: '1.4rem', marginBottom: '0.6rem' }}>Recent events</h4>
                      {orderAnalytics.recent.length === 0 ? (
                        <p className="catalog-empty">No events yet.</p>
                      ) : (
                        <ul className="review-list">
                          {orderAnalytics.recent.map((r) => (
                            <li key={r.orderId} className="review-item">
                              <strong>Order #{r.orderId}</strong>
                              {r.userId != null && <span> · user {r.userId}</span>}
                              <span> · ${Number(r.totalAmount || 0).toFixed(2)}</span>
                              {r.status && <span className="badge subtle"> {r.status}</span>}
                              <span> · {new Date(r.occurredAt).toLocaleString()}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </>
              )}
              {adminTab === 'ops' && (
                <>
                  <div className="review-list">
                    <div className="review-item">
                      <strong>Gateway</strong> <span className="badge subtle">{opsOverview?.gateway ?? 'unknown'}</span>
                    </div>
                    <div className="review-item">
                      <strong>User Service</strong> <span className="badge subtle">{opsOverview?.services?.user ?? 'unknown'}</span>
                    </div>
                    <div className="review-item">
                      <strong>Product Service</strong> <span className="badge subtle">{opsOverview?.services?.product ?? 'unknown'}</span>
                    </div>
                    <div className="review-item">
                      <strong>Order Service</strong> <span className="badge subtle">{opsOverview?.services?.order ?? 'unknown'}</span>
                    </div>
                    <button type="button" className="btn-secondary" onClick={loadOpsOverview}>Refresh</button>
                  </div>
                  <div className="catalog-filters">
                    <input
                      className="filter-input"
                      placeholder="Search audit logs"
                      value={adminAuditQuery}
                      onChange={(e) => {
                        setAdminAuditQuery(e.target.value)
                        setAdminAuditPage(1)
                      }}
                    />
                    <button type="button" className="btn-secondary" onClick={loadAdminAuditLogs}>Reload logs</button>
                  </div>
                  {adminAuditLoading && <p className="catalog-empty">Loading audit logs…</p>}
                  {!adminAuditLoading && adminAuditEntries.length === 0 && (
                    <p className="catalog-empty">
                      {adminAuditQuery
                        ? 'No audit logs match your search.'
                        : 'No audit logs yet. Perform an admin action (edit a product, change an order status, toggle a promotion, etc.) and it will appear here.'}
                    </p>
                  )}
                  {!adminAuditLoading && adminAuditEntries.length > 0 && (
                    <>
                      <ul className="admin-order-list">
                        {adminAuditEntries.map((log) => (
                          <li key={log.id} className="admin-order-row">
                            <div>
                              <span className="order-id">{log.action}</span>
                              <span>{log.target}</span>
                              <span>{new Date(log.createdAt).toLocaleString()}</span>
                              <span>{log.actor?.email ?? 'system'}</span>
                              {log.details && Object.keys(log.details).length > 0 && (
                                <span className="badge subtle">
                                  {Object.entries(log.details)
                                    .filter(([, v]) => v != null && v !== '')
                                    .slice(0, 3)
                                    .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
                                    .join(' · ')}
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                      <PaginationControls
                        page={adminAuditPage}
                        pageSize={AUDIT_PAGE_SIZE}
                        total={adminAuditTotal}
                        loading={adminAuditLoading}
                        onPageChange={setAdminAuditPage}
                      />
                    </>
                  )}
                </>
              )}
              {adminTab === 'products' && adminProductsLoading && (
                <div className="orders-loading">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="product-card skeleton" />
                  ))}
                </div>
              )}
              {adminTab === 'products' && !adminProductsLoading && adminProducts.length === 0 && (
                <p className="catalog-empty">No products. Add one above.</p>
              )}
              {adminTab === 'products' && !adminProductsLoading && adminProducts.length > 0 && (
                <>
                  <ul className="admin-product-list">
                    {adminProducts.map((p) => (
                      <li key={p.id} className="admin-product-row">
                        <div>
                          <strong>{p.name}</strong>
                          {p.category && <span className="badge">{p.category}</span>}
                          <span className="admin-product-meta">
                            ${p.price.toFixed(2)} · {p.stock} in stock
                          </span>
                        </div>
                        <div className="admin-product-actions">
                          <button type="button" className="btn-ghost" onClick={() => openAdminForm(p)}>
                            Edit
                          </button>
                          <button type="button" className="btn-danger" onClick={() => handleAdminDelete(p.id)}>
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <PaginationControls
                    page={adminProductsPage}
                    pageSize={ADMIN_PAGE_SIZE}
                    total={adminProductsTotal}
                    loading={adminProductsLoading}
                    onPageChange={setAdminProductsPage}
                  />
                </>
              )}

              <AnimatePresence>
                {adminFormOpen !== null && (
                  <motion.div
                    className="product-detail-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setAdminFormOpen(null)}
                  >
                    <motion.form
                      className="admin-form-modal"
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      onClick={(e) => e.stopPropagation()}
                      onSubmit={handleAdminSubmit}
                    >
                      <h3>{adminFormOpen === 'create' ? 'New product' : 'Edit product'}</h3>
                      <label className="field">
                        <span>Name</span>
                        <input
                          value={adminFormData.name}
                          onChange={(e) => setAdminFormData((d) => ({ ...d, name: e.target.value }))}
                          required
                        />
                      </label>
                      <label className="field">
                        <span>Description</span>
                        <input
                          value={adminFormData.description}
                          onChange={(e) => setAdminFormData((d) => ({ ...d, description: e.target.value }))}
                        />
                      </label>
                      <label className="field">
                        <span>Category</span>
                        <input
                          value={adminFormData.category}
                          onChange={(e) => setAdminFormData((d) => ({ ...d, category: e.target.value }))}
                        />
                      </label>
                      <label className="field">
                        <span>Price</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={adminFormData.price}
                          onChange={(e) => setAdminFormData((d) => ({ ...d, price: e.target.value }))}
                          required
                        />
                      </label>
                      <label className="field">
                        <span>Stock</span>
                        <input
                          type="number"
                          min="0"
                          value={adminFormData.stock}
                          onChange={(e) => setAdminFormData((d) => ({ ...d, stock: e.target.value }))}
                          required
                        />
                      </label>
                      <label className="field">
                        <span>Image URL</span>
                        <input
                          value={adminFormData.image_url}
                          onChange={(e) => setAdminFormData((d) => ({ ...d, image_url: e.target.value }))}
                          placeholder="https://..."
                        />
                      </label>
                      <div className="admin-form-actions">
                        <button type="button" className="btn-secondary" onClick={() => setAdminFormOpen(null)}>
                          Cancel
                        </button>
                        <motion.button
                          type="submit"
                          className="btn-primary"
                          disabled={adminFormSaving}
                          whileHover={{ scale: adminFormSaving ? 1 : 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {adminFormSaving ? 'Saving…' : adminFormOpen === 'create' ? 'Create' : 'Save'}
                        </motion.button>
                      </div>
                    </motion.form>
                  </motion.div>
                )}
                {adminReviewEdit !== null && (
                  <motion.div
                    className="product-detail-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setAdminReviewEdit(null)}
                  >
                    <motion.form
                      className="admin-form-modal"
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      onClick={(e) => e.stopPropagation()}
                      onSubmit={handleAdminReviewSave}
                    >
                      <h3>Edit review #{adminReviewEdit.id}</h3>
                      <label className="field">
                        <span>Author</span>
                        <input
                          value={adminReviewEdit.author_name}
                          onChange={(e) => setAdminReviewEdit((d) => d ? { ...d, author_name: e.target.value } : d)}
                          required
                        />
                      </label>
                      <label className="field">
                        <span>Rating</span>
                        <input
                          type="number"
                          min={1}
                          max={5}
                          value={adminReviewEdit.rating}
                          onChange={(e) => setAdminReviewEdit((d) => d ? { ...d, rating: Number(e.target.value) } : d)}
                          required
                        />
                      </label>
                      <label className="field">
                        <span>Comment</span>
                        <input
                          value={adminReviewEdit.comment}
                          onChange={(e) => setAdminReviewEdit((d) => d ? { ...d, comment: e.target.value } : d)}
                        />
                      </label>
                      <div className="admin-form-actions">
                        <button type="button" className="btn-secondary" onClick={() => setAdminReviewEdit(null)}>
                          Cancel
                        </button>
                        <button type="submit" className="btn-primary">
                          Save review
                        </button>
                      </div>
                    </motion.form>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>
          )}

          {screen === 'profile' && user && (
            <motion.section
              key="profile"
              className="panel catalog-panel"
              initial={{ opacity: 0, scale: 0.98, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -20 }}
              transition={{ duration: 0.35 }}
            >
              <div className="catalog-header">
                <h2>Profile</h2>
                <p>Update your name and email.</p>
              </div>
              <motion.form
                className="auth-form"
                onSubmit={handleProfileSubmit}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <label className="field">
                  <span>Name</span>
                  <input
                    name="name"
                    type="text"
                    defaultValue={user.name}
                    placeholder="Your name"
                    required
                  />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input
                    name="email"
                    type="email"
                    defaultValue={user.email}
                    placeholder="you@example.com"
                    required
                  />
                </label>
                {profileMessage && (
                  <p className={profileMessage.startsWith('Profile') ? 'profile-success' : 'profile-error'}>
                    {profileMessage}
                  </p>
                )}
                <motion.button
                  type="submit"
                  className="btn-primary full"
                  disabled={profileSaving}
                  whileHover={{ scale: profileSaving ? 1 : 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {profileSaving ? 'Saving…' : 'Save profile'}
                </motion.button>
              </motion.form>
            </motion.section>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedProductId != null && (
            <motion.div
              className="product-detail-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProductId(null)}
            >
              <motion.div
                className="product-detail-modal"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: 'spring', damping: 25 }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="product-detail-close"
                  onClick={() => setSelectedProductId(null)}
                  aria-label="Close"
                >
                  ×
                </button>
                {productDetailLoading && (
                  <div className="product-detail-skeleton" />
                )}
                {!productDetailLoading && productDetail && (
                  <>
                    {productDetail.image_url && (
                      <img src={productDetail.image_url} alt="" className="product-detail-img" />
                    )}
                    <div className="product-detail-header">
                      <h3>{productDetail.name}</h3>
                      <span className="product-price">${productDetail.price.toFixed(2)}</span>
                    </div>
                    {productDetail.description && (
                      <p className="product-desc">{productDetail.description}</p>
                    )}
                    <div className="product-meta">
                      {productDetail.category && <span className="badge">{productDetail.category}</span>}
                      <span className="badge subtle">{productDetail.stock} in stock</span>
                      <span className="badge subtle">
                        {productDetail.rating_count
                          ? `★ ${productDetail.rating_avg?.toFixed(1)} (${productDetail.rating_count})`
                          : 'No ratings yet'}
                      </span>
                    </div>
                    <motion.button
                      className="btn-secondary full"
                      whileHover={{ scale: 1.02, y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => toggleWishlist(productDetail.id)}
                    >
                      {wishlistIds.includes(productDetail.id) ? 'Remove from wishlist' : 'Save to wishlist'}
                    </motion.button>
                    <motion.button
                      className="btn-primary full"
                      whileHover={{ scale: 1.02, y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      disabled={productDetail.stock < 1}
                      onClick={() => {
                        addToCart(productDetail)
                        setCartOpen(true)
                        setSelectedProductId(null)
                      }}
                    >
                      {productDetail.stock > 0 ? 'Add to cart' : 'Out of stock'}
                    </motion.button>
                    {relatedProducts.length > 0 && (
                      <div className="related-products">
                        <h4>Related products</h4>
                        <div className="related-products-grid">
                          {relatedProducts.map((rp) => (
                            <button
                              key={rp.id}
                              type="button"
                              className="related-item"
                              onClick={() => openProduct(rp.id)}
                            >
                              <span>{rp.name}</span>
                              <span>${rp.price.toFixed(2)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="related-products">
                      <h4>Ratings & reviews</h4>
                      <div className="notification-filters">
                        {([
                          { id: 'newest', label: 'Newest' },
                          { id: 'highest', label: 'Highest rated' },
                          { id: 'lowest', label: 'Lowest rated' },
                          { id: 'helpful', label: 'Most helpful' },
                        ] as const).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            className={reviewSort === opt.id ? 'is-active' : ''}
                            onClick={() => setReviewSort(opt.id)}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {user ? (
                        <form className="review-form" onSubmit={handleSubmitReview}>
                          <label className="field">
                            <span>Rating</span>
                            <select value={reviewRating} onChange={(e) => setReviewRating(Number(e.target.value))}>
                              <option value={5}>5 - Excellent</option>
                              <option value={4}>4 - Good</option>
                              <option value={3}>3 - Average</option>
                              <option value={2}>2 - Fair</option>
                              <option value={1}>1 - Poor</option>
                            </select>
                          </label>
                          <label className="field">
                            <span>Comment (optional)</span>
                            <input
                              value={reviewComment}
                              onChange={(e) => setReviewComment(e.target.value)}
                              placeholder="Share your experience"
                            />
                          </label>
                          <button className="btn-secondary" type="submit" disabled={reviewSubmitting}>
                            {reviewSubmitting ? 'Posting…' : reviewEditingId != null ? 'Save changes' : 'Post review'}
                          </button>
                          {reviewEditingId != null && (
                            <button
                              className="btn-ghost"
                              type="button"
                              onClick={() => {
                                setReviewEditingId(null)
                                setReviewRating(5)
                                setReviewComment('')
                              }}
                            >
                              Cancel edit
                            </button>
                          )}
                        </form>
                      ) : (
                        <p className="catalog-empty">Sign in to leave a rating and review.</p>
                      )}
                      {productReviews.length === 0 ? (
                        <p className="catalog-empty">No reviews yet.</p>
                      ) : (
                        <div className="review-list">
                          <p className="review-count">
                            Showing {productReviews.length} of {reviewTotalCount} reviews
                          </p>
                          {productReviews.map((review) => (
                            <div key={review.id} className="review-item">
                              <div>
                                <strong>{review.author_name}</strong>
                                <span> · {new Date(review.created_at).toLocaleDateString()}</span>
                                {review.verified_purchase ? (
                                  <span className="badge subtle review-verified">Verified purchase</span>
                                ) : null}
                              </div>
                              <div>★ {review.rating}/5</div>
                              {review.comment && <p>{review.comment}</p>}
                              <div className="review-actions">
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  disabled={reviewHelpfulBusyId === review.id || review.has_voted}
                                  onClick={() => handleMarkReviewHelpful(review.id)}
                                >
                                  {review.has_voted ? 'Helpful ✓' : `Helpful (${review.helpful_votes ?? 0})`}
                                </button>
                              </div>
                              {user?.name?.trim().toLowerCase() === review.author_name.trim().toLowerCase() && (
                                <div className="review-actions">
                                  <button
                                    type="button"
                                    className="btn-ghost"
                                    onClick={() => {
                                      setReviewEditingId(review.id)
                                      setReviewRating(review.rating)
                                      setReviewComment(review.comment ?? '')
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-danger"
                                    onClick={() => handleDeleteReview(review.id)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {reviewHasMore && (
                        <button
                          type="button"
                          className="btn-ghost"
                          disabled={reviewLoading || !productDetail}
                          onClick={() => productDetail && loadProductReviewsPage(productDetail.id, true)}
                        >
                          {reviewLoading ? 'Loading…' : 'Load more reviews'}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

export default App
