import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  MapPin, 
  Search, 
  Plus, 
  Star,
  Info,
  DollarSign,
  Package,
  Truck,
  Video,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  X,
  CreditCard,
  Banknote,
  QrCode,
  Building2,
  CreditCard as CreditCardIcon
} from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, where, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { cn, compressImage, calculateTotalBase64Size, calculateDistance } from '../lib/utils';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface Item {
  id: string;
  sellerId: string;
  sellerName: string;
  title: string;
  description: string;
  category: string;
  price: number;
  unit: string;
  location: string;
  lat?: number;
  lng?: number;
  paymentInfo?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    promptpay: string;
  };
  images?: string[];
  videoURL?: string;
  createdAt: any;
}

const MARKET_CATEGORIES = ['ทั้งหมด', 'ผลผลิตสด', 'แปรรูป', 'สมุนไพร', 'อุปกรณ์เกษตร', 'เมล็ดพันธุ์', 'ปุ๋ย/ยา'];
const SORT_OPTIONS = [
  { label: 'ล่าสุด', value: 'date-desc' },
  { label: 'ราคา: ต่ำ-สูง', value: 'price-asc' },
  { label: 'ราคา: สูง-ต่ำ', value: 'price-desc' }
];

interface Order {
  id: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  itemId: string;
  itemTitle: string;
  itemPrice: number;
  itemUnit: string;
  itemImage?: string;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  statusHistory: { status: string, timestamp: any }[];
  shippingAddress?: string;
  addressDetail?: string;
  subDistrict?: string;
  district?: string;
  province?: string;
  zipcode?: string;
  paymentMethod?: 'cod' | 'online';
  paymentStatus?: 'pending' | 'paid';
  paymentChannel?: string;
  paymentInfo?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    promptpay: string;
  };
  trackingNumber?: string;
  lat?: number;
  lng?: number;
  createdAt: any;
}

export default function MarketplacePage() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'buy' | 'sell' | 'my-orders'>('buy');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [purchaseItem, setPurchaseItem] = useState<Item | null>(null);
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [addressForm, setAddressForm] = useState({
    detail: "",
    subDistrict: "",
    district: "",
    province: profile?.province || "",
    zipcode: ""
  });
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online'>('cod');
  const [isAdding, setIsAdding] = useState(false);
  const [search, setSearch] = useState("");
  
  // Filters
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');
  const [sortBy, setSortBy] = useState('date-desc');
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newItem, setNewItem] = useState({
    title: "",
    description: "",
    category: MARKET_CATEGORIES[1],
    price: "",
    unit: "กก.",
    location: profile?.province || "กรุงเทพฯ",
    videoURL: "",
    lat: 13.7563,
    lng: 100.5018,
    paymentInfo: {
      bankName: "",
      accountName: "",
      accountNumber: "",
      promptpay: ""
    }
  });

  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || "";

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error getting geolocation:", error);
          if (profile?.lat && profile?.lng) {
            setUserLocation({ lat: profile.lat, lng: profile.lng });
          }
        }
      );
    }
  }, [profile]);

  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, 'marketplace'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Item));
      setItems(data);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'orders'),
      where(activeTab === 'my-orders' ? 'buyerId' : 'sellerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(data);
    });
    return () => unsubscribe();
  }, [user, activeTab]);

  const handleAddItem = async () => {
    if (!newItem.title || !newItem.price || !user) return;
    
    // Safety check for total document size
    const totalImageSize = calculateTotalBase64Size(selectedImages);
    if (totalImageSize > 800000) { // Slightly more conservative limit (approx 600KB binary)
      alert(`ขนาดรูปภาพรวมกันใหญ่เกินไป (${(totalImageSize/1024).toFixed(0)}KB characters) กรุณาลบออกบางรูปหรือลดคุณภาพภาพ`);
      return;
    }
    
    const marketplacePath = 'marketplace';
    try {
      await addDoc(collection(db, marketplacePath), {
        sellerId: user.uid,
        sellerName: profile?.displayName || 'เกษตรกรไทย',
        title: newItem.title,
        description: newItem.description,
        category: newItem.category,
        price: Number(newItem.price),
        unit: newItem.unit,
        location: newItem.location,
        lat: newItem.lat,
        lng: newItem.lng,
        paymentInfo: newItem.paymentInfo,
        videoURL: newItem.videoURL,
        images: selectedImages,
        createdAt: serverTimestamp()
      });
      
      setIsAdding(false);
      setSelectedImages([]);
      setNewItem({ 
        title: "", 
        description: "", 
        category: MARKET_CATEGORIES[1], 
        price: "", 
        unit: "กก.", 
        location: profile?.province || "", 
        videoURL: "", 
        lat: 13.7563, 
        lng: 100.5018,
        paymentInfo: {
          bankName: "",
          accountName: "",
          accountNumber: "",
          promptpay: ""
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, marketplacePath);
    }
  };

  const handleBuy = async (item: Item) => {
    if (!user) return;
    const ordersPath = 'orders';
    const fullAddress = `${addressForm.detail}, ${addressForm.subDistrict}, ${addressForm.district}, ${addressForm.province} ${addressForm.zipcode}`;
    
    try {
      await addDoc(collection(db, ordersPath), {
        buyerId: user.uid,
        buyerName: profile?.displayName || 'เกษตรกรนิรนาม',
        sellerId: item.sellerId,
        sellerName: item.sellerName,
        itemId: item.id,
        itemTitle: item.title,
        itemPrice: item.price,
        itemUnit: item.unit,
        itemImage: item.images?.[0] || '',
        totalPrice: item.price,
        status: 'pending',
        shippingAddress: fullAddress,
        addressDetail: addressForm.detail,
        subDistrict: addressForm.subDistrict,
        district: addressForm.district,
        province: addressForm.province,
        zipcode: addressForm.zipcode,
        paymentMethod: paymentMethod,
        paymentStatus: 'pending',
        paymentInfo: item.paymentInfo || null,
        lat: item.lat || null,
        lng: item.lng || null,
        statusHistory: [
          { status: 'pending', timestamp: new Date() }
        ],
        createdAt: serverTimestamp()
      });
      alert('ส่งคำสั่งซื้อเรียบร้อยแล้ว! ผู้ส่งจะทำการตรวจสอบและยืนยัน');
      setPurchaseItem(null);
      setCheckoutStep(1);
      setActiveTab('my-orders');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, ordersPath);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    const orderPath = `orders/${orderId}`;
    try {
      await updateDoc(doc(db, 'orders', orderId), { 
        status: newStatus,
        statusHistory: arrayUnion({
          status: newStatus,
          timestamp: new Date()
        }),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, orderPath);
    }
  };

  const updatePaymentStatus = async (orderId: string, newStatus: Order['paymentStatus']) => {
    const orderPath = `orders/${orderId}`;
    try {
      await updateDoc(doc(db, 'orders', orderId), { 
        paymentStatus: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, orderPath);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedImages.length > 4) {
      alert("คุณสามารถอัปโหลดรูปภาพได้สูงสุด 4 รูป");
      return;
    }

    const currentTotalSize = calculateTotalBase64Size(selectedImages);
    if (currentTotalSize > 750000) {
        alert("ขนาดรูปภาพรวมปัจจุบันใกล้เต็มขีดจำกัดแล้ว กรุณาลบรูปเดิมก่อนเพิ่มใหม่");
        return;
    }

    for (const file of files) {
      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        const base64 = await base64Promise;
        // Compress more aggressively
        const compressed = await compressImage(base64, 600, 600, 0.4);
        
        // Double check individual size
        if (compressed.length > 250000) {
            // If still too large, try even smaller
            const superCompressed = await compressImage(base64, 400, 400, 0.2);
            setSelectedImages(prev => [...prev, superCompressed]);
        } else {
            setSelectedImages(prev => [...prev, compressed]);
        }
      } catch (err) {
        console.error("Compression error:", err);
        alert("ไม่สามารถอัปโหลดรูปนี้ได้ กรุณาลองใช้รูปอื่น");
      }
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const filteredItems = items
    .filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) || 
                           item.location.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === 'ทั้งหมด' || item.category === selectedCategory;
      const matchesMinPrice = !priceRange.min || item.price >= Number(priceRange.min);
      const matchesMaxPrice = !priceRange.max || item.price <= Number(priceRange.max);
      
      return matchesSearch && matchesCategory && matchesMinPrice && matchesMaxPrice;
    })
    .sort((a, b) => {
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      // Default date-desc
      const dateA = a.createdAt?.toMillis() || 0;
      const dateB = b.createdAt?.toMillis() || 0;
      return dateB - dateA;
    });

  return (
    <div className="p-4 space-y-6">
      {/* Header & Tabs */}
      <section className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-[#1a1a1a]">ตลาดเกษตรกร</h2>
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-[#5A5A40] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg active:scale-95 transition-transform"
          >
            <Plus className="w-5 h-5" />
            <span>ลงขาย</span>
          </button>
        </div>

        <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
          <button 
            onClick={() => setActiveTab('buy')}
            className={cn(
              "flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
              activeTab === 'buy' ? "bg-white text-[#5A5A40] shadow-sm" : "text-gray-400"
            )}
          >
            เลือกซื้อ
          </button>
          <button 
            onClick={() => setActiveTab('my-orders')}
            className={cn(
              "flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
              activeTab === 'my-orders' ? "bg-white text-[#5A5A40] shadow-sm" : "text-gray-400"
            )}
          >
            การซื้อของฉัน
          </button>
          <button 
            onClick={() => setActiveTab('sell')}
            className={cn(
              "flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
              activeTab === 'sell' ? "bg-white text-[#5A5A40] shadow-sm" : "text-gray-400"
            )}
          >
            การขายของฉัน
          </button>
        </div>
        
        {activeTab === 'buy' && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหาพืชผล สมุนไพร ปุ๋ย..." 
                  className="w-full bg-white border border-[#5A5A40]/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none"
                />
              </div>
              <div className="flex bg-gray-100 p-1 rounded-2xl shrink-0">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "p-2 rounded-xl transition-all",
                    viewMode === 'grid' ? "bg-white text-[#5A5A40] shadow-sm" : "text-gray-400"
                  )}
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setViewMode('map')}
                  className={cn(
                    "p-2 rounded-xl transition-all",
                    viewMode === 'map' ? "bg-white text-[#5A5A40] shadow-sm" : "text-gray-400"
                  )}
                >
                  <MapPin className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex-1 min-w-[120px]">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-white border border-[#5A5A40]/10 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-[#5A5A40]"
                >
                  {MARKET_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[120px]">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full bg-white border border-[#5A5A40]/10 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-[#5A5A40]"
                >
                  {SORT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="number"
                  placeholder="Min"
                  value={priceRange.min}
                  onChange={e => setPriceRange({...priceRange, min: e.target.value})}
                  className="w-16 bg-white border border-[#5A5A40]/10 rounded-xl px-2 py-2 text-[10px] font-bold outline-none"
                />
                <span className="text-gray-300">-</span>
                <input 
                  type="number"
                  placeholder="Max"
                  value={priceRange.max}
                  onChange={e => setPriceRange({...priceRange, max: e.target.value})}
                  className="w-16 bg-white border border-[#5A5A40]/10 rounded-xl px-2 py-2 text-[10px] font-bold outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {activeTab === 'buy' ? (
        viewMode === 'grid' ? (
          /* Grid of Items */
          <div className="grid grid-cols-2 gap-4 pb-12">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm animate-pulse">
                  <div className="aspect-square bg-gray-100" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-gray-100 rounded-lg w-3/4" />
                    <div className="h-3 bg-gray-50 rounded-lg w-1/2" />
                    <div className="pt-2 flex justify-between items-center">
                      <div className="h-6 bg-gray-100 rounded-lg w-1/3" />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              filteredItems.map(item => (
                <motion.div 
                  key={item.id}
                  whileHover={{ y: -4 }}
                  className="bg-white rounded-[32px] border border-gray-100 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-[#5A5A40]/5 transition-all flex flex-col h-full group"
                >
                  {/* Image Placeholder */}
                  <div className="aspect-square bg-gray-50 flex items-center justify-center relative overflow-hidden">
                    {item.images?.[0] ? (
                      <motion.img 
                        initial={{ scale: 1 }}
                        whileHover={{ scale: 1.05 }}
                        src={item.images[0]} 
                        alt={item.title} 
                        className="w-full h-full object-cover transition-transform duration-500" 
                      />
                    ) : (
                      <ShoppingBag className="w-12 h-12 text-gray-200" />
                    )}
                    
                    {/* Category Tag */}
                    <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest text-[#5A5A40] shadow-sm">
                      {item.category}
                    </div>

                    {item.videoURL && (
                      <div className="absolute bottom-3 left-3 p-2 bg-black/40 backdrop-blur-md rounded-xl shadow-lg">
                        <Video className="w-3 h-3 text-white" />
                      </div>
                    )}
                    
                    {/* Freshness/Badge */}
                    <div className="absolute top-3 right-3 bg-[#5A5A40] text-white p-2 rounded-xl shadow-lg">
                      <Star className="w-3 h-3 fill-current" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex-1 space-y-1">
                      <h4 className="font-black text-sm text-[#1a1a1a] line-clamp-1 leading-tight group-hover:text-[#5A5A40] transition-colors">{item.title}</h4>
                      <p className="text-[10px] text-gray-400 font-bold line-clamp-1">โดย {item.sellerName || 'เกษตรกรไทย'}</p>
                    </div>

                    <div className="mt-3 space-y-3">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <div className="flex items-center gap-1 text-gray-400 overflow-hidden">
                          <MapPin className="w-3 h-3 shrink-0 text-[#5A5A40]" />
                          <span className="truncate">{item.location}</span>
                        </div>
                        {userLocation && item.lat && item.lng && (
                          <span className="text-[#5A5A40]/60 shrink-0 font-black">
                            {calculateDistance(userLocation.lat, userLocation.lng, item.lat, item.lng).toFixed(1)} กม.
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between items-end">
                        <div className="text-[#5A5A40] font-black text-xl leading-none">
                          <span className="text-xs mr-0.5">฿</span>
                          {item.price.toLocaleString()}
                          <span className="text-[10px] text-gray-400 font-bold ml-1">/{item.unit || 'กก.'}</span>
                        </div>
                        <button 
                          onClick={() => setPurchaseItem(item)}
                          className="bg-[#5A5A40] text-white p-2.5 rounded-2xl shadow-lg shadow-[#5A5A40]/20 hover:scale-105 active:scale-95 transition-all"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
            {!isLoading && filteredItems.length === 0 && (
              <div className="col-span-2 py-20 text-center opacity-20">
                <Search className="w-16 h-16 mx-auto mb-4" />
                <p className="font-black uppercase tracking-widest text-sm">ไม่พบสินค้าที่คุณค้นหา</p>
              </div>
            )}
          </div>
        ) : (
          /* Map View */
          <div className="relative h-[60vh] rounded-[40px] overflow-hidden border-4 border-white shadow-xl">
            {GOOGLE_MAPS_API_KEY ? (
              <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="weekly">
                <Map
                  defaultCenter={{ 
                    lat: userLocation?.lat || profile?.lat || 13.7563, 
                    lng: userLocation?.lng || profile?.lng || 100.5018 
                  }}
                  defaultZoom={10}
                  mapId="BROWSE_MAP"
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  gestureHandling={'greedy'}
                  disableDefaultUI={true}
                >
                  {filteredItems.filter(item => item.lat && item.lng).map(item => (
                    <AdvancedMarker 
                      key={item.id}
                      position={{ lat: item.lat!, lng: item.lng! }}
                      onClick={() => setSelectedItem(item)}
                    >
                      <Pin background="#5A5A40" glyphColor="#fff" borderColor="#fff">
                        <div className="p-1 px-2 text-[10px] font-black text-white whitespace-nowrap">
                          ฿{item.price}
                        </div>
                      </Pin>
                    </AdvancedMarker>
                  ))}
                </Map>
              </APIProvider>
            ) : (
              <div className="w-full h-full bg-gray-100 flex items-center justify-center p-8 text-center" id="map_unavailable_msg">
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-loose">
                  กรุณาตั้งค่า Google Maps API Key<br/>เพื่อใช้งานระบบแผนที่การค้า
                </p>
              </div>
            )}

            {/* Selected Item Detail Over Map */}
            <AnimatePresence>
              {selectedItem && (
                <motion.div 
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 100, opacity: 0 }}
                  className="absolute bottom-6 left-6 right-6 bg-white p-4 rounded-[32px] shadow-2xl flex gap-4 items-center border border-gray-100"
                  id={`map_item_${selectedItem.id}`}
                >
                  <div className="w-20 h-20 bg-gray-100 rounded-2xl overflow-hidden shrink-0">
                    {selectedItem.images?.[0] ? (
                      <img src={selectedItem.images[0]} className="w-full h-full object-cover" alt={selectedItem.title} />
                    ) : (
                      <ShoppingBag className="w-full h-full p-4 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-[#1a1a1a] truncate">{selectedItem.title}</h4>
                    <div className="flex items-center gap-2">
                      <p className="text-[#5A5A40] font-black">฿{selectedItem.price}/{selectedItem.unit}</p>
                      {userLocation && selectedItem.lat && selectedItem.lng && (
                        <span className="text-[10px] text-gray-400 font-bold bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                          {calculateDistance(userLocation.lat, userLocation.lng, selectedItem.lat, selectedItem.lng).toFixed(1)} กม.
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold truncate flex items-center gap-1">
                      <MapPin className="w-2 h-2" />
                      {selectedItem.location}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => setSelectedItem(null)}
                      className="p-2 text-gray-300 hover:text-red-500"
                    >
                      <X className="w-6 h-6" />
                    </button>
                    <button 
                      onClick={() => setPurchaseItem(selectedItem)}
                      className="bg-[#5A5A40] text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest"
                    >
                      ซื้อ
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      ) : (
        /* Order Tracking View */
        <div className="space-y-4 pb-20">
          {orders.map(order => (
            <motion.div 
              key={order.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => setSelectedOrder(order)}
              className="bg-white p-4 rounded-[32px] border border-gray-100 shadow-sm space-y-4 cursor-pointer hover:border-[#5A5A40]/20 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black text-[#1a1a1a]">{order.itemTitle}</h4>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">ORDER: #{order.id.slice(0, 8)}</p>
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                  order.status === 'pending' ? "bg-orange-50 text-orange-600" :
                  order.status === 'confirmed' ? "bg-blue-50 text-blue-600" :
                  order.status === 'shipped' ? "bg-purple-50 text-purple-600" :
                  order.status === 'delivered' ? "bg-green-50 text-green-600" :
                  "bg-gray-50 text-gray-400"
                )}>
                  {order.status === 'pending' ? 'รอยืนยัน' :
                   order.status === 'confirmed' ? 'ยืนยันแล้ว' :
                   order.status === 'shipped' ? 'จุดส่งสินค้า' :
                   order.status === 'delivered' ? 'ส่งถึงแล้ว' : 'ยกเลิก'}
                </div>
              </div>

              {/* Progress Stepper */}
              <div className="flex items-center justify-between relative px-2">
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-100 -translate-y-1/2 -z-10" />
                {['pending', 'confirmed', 'shipped', 'delivered'].map((s, i) => {
                  const statusIdx = ['pending', 'confirmed', 'shipped', 'delivered'].indexOf(order.status);
                  const isCompleted = statusIdx >= i;
                  return (
                    <div key={s} className="flex flex-col items-center gap-1">
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center bg-white transition-all",
                        isCompleted ? "border-[#5A5A40] bg-[#5A5A40] text-white" : "border-gray-200 text-gray-200"
                      )}>
                        {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-sm font-black text-[#5A5A40]">฿{order.totalPrice.toLocaleString()}</p>
                {activeTab === 'sell' && order.status === 'pending' && (
                  <button 
                    onClick={() => updateOrderStatus(order.id, 'confirmed')}
                    className="bg-[#5A5A40] text-white px-4 py-2 rounded-xl text-xs font-bold"
                  >
                    ยืนยันคำสั่งซื้อ
                  </button>
                )}
                {activeTab === 'sell' && order.status === 'confirmed' && (
                  <button 
                    onClick={() => updateOrderStatus(order.id, 'shipped')}
                    className="bg-purple-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
                  >
                    จัดส่งสินค้า
                  </button>
                )}
                {activeTab === 'my-orders' && order.status === 'shipped' && (
                  <button 
                    onClick={() => updateOrderStatus(order.id, 'delivered')}
                    className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
                  >
                    ได้รับสินค้าแล้ว
                  </button>
                )}
              </div>
            </motion.div>
          ))}
          {orders.length === 0 && (
            <div className="text-center py-12 opacity-20">
              <Package className="w-16 h-16 mx-auto mb-4" />
              <p className="text-sm font-bold">ไม่มีประวัติคำสั่งซื้อ</p>
            </div>
          )}
        </div>
      )}

      {/* Add Item Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-[40px] p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-[#1a1a1a]">ลงขายพืชผล</h3>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">แลกเปลี่ยนผลผลิตในชุมชน</p>
                </div>
                <button onClick={() => setIsAdding(false)} className="p-2 text-gray-300 hover:text-red-500">
                  <X className="w-8 h-8" />
                </button>
              </div>

              <div className="space-y-5">
                {/* Media Row */}
                <div className="space-y-4">
                  <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                    {selectedImages.map((src, index) => (
                      <div key={index} className="relative w-24 h-24 rounded-2xl overflow-hidden shrink-0 group shadow-md">
                        <img src={src} className="w-full h-full object-cover" alt="Preview" />
                        <button 
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full hover:bg-black transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {selectedImages.length < 4 && (
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-24 h-24 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-1 group cursor-pointer hover:border-[#5A5A40]/30 transition-all shrink-0"
                      >
                        <ImageIcon className="w-6 h-6 text-gray-300 group-hover:text-[#5A5A40]" />
                        <span className="text-[10px] font-bold text-gray-400 group-hover:text-[#5A5A40]">เพิ่มรูป ({selectedImages.length}/4)</span>
                      </button>
                    )}
                  </div>
                  
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                  />

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">ลิงก์วิดีโอ (Optional)</label>
                    <div className="relative">
                      <Video className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        value={newItem.videoURL}
                        onChange={e => setNewItem({...newItem, videoURL: e.target.value})}
                        placeholder="Youtube/TikTok link..."
                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-10 pr-4 py-4 text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">ชื่อสินค้า</label>
                  <input 
                    value={newItem.title}
                    onChange={e => setNewItem({...newItem, title: e.target.value})}
                    placeholder="เช่น ขิงสดออร์แกนิก คุณภาพส่งออก"
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-[#5A5A40] outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">หมวดหมู่</label>
                  <select
                    value={newItem.category}
                    onChange={e => setNewItem({...newItem, category: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-2 focus:ring-[#5A5A40] outline-none"
                  >
                    {MARKET_CATEGORIES.filter(c => c !== 'ทั้งหมด').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">ราคา (บาท)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        type="number"
                        value={newItem.price}
                        onChange={e => setNewItem({...newItem, price: e.target.value})}
                        placeholder="0.00"
                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-10 pr-4 py-4 text-sm font-black focus:ring-2 focus:ring-[#5A5A40] outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">หน่วย</label>
                    <select 
                      value={newItem.unit}
                      onChange={e => setNewItem({...newItem, unit: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-sm font-bold focus:ring-2 focus:ring-[#5A5A40] outline-none appearance-none"
                    >
                      <option>กก.</option>
                      <option>ถุง</option>
                      <option>ต้น</option>
                      <option>ชิ้น</option>
                      <option>ลิตร</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">รายละเอียด</label>
                  <textarea 
                    value={newItem.description}
                    onChange={e => setNewItem({...newItem, description: e.target.value})}
                    placeholder="ระบุจุดเด่น วิธีการปลูก หรือข้อความถึงผู้ซื้อ..."
                    className="w-full h-24 bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none resize-none"
                  />
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">ข้อมูลรับชำระเงิน (สำหรับโอนเงินออนไลน์)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 ml-1">ธนาคาร</label>
                      <input 
                        value={newItem.paymentInfo?.bankName}
                        onChange={e => setNewItem({...newItem, paymentInfo: {...newItem.paymentInfo!, bankName: e.target.value}})}
                        placeholder="เช่น กสิกรไทย"
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-[#5A5A40]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 ml-1">ชื่อบัญชี</label>
                      <input 
                        value={newItem.paymentInfo?.accountName}
                        onChange={e => setNewItem({...newItem, paymentInfo: {...newItem.paymentInfo!, accountName: e.target.value}})}
                        placeholder="ชื่อ-นามสกุล"
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-[#5A5A40]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 ml-1">เลขบัญชี</label>
                      <input 
                        value={newItem.paymentInfo?.accountNumber}
                        onChange={e => setNewItem({...newItem, paymentInfo: {...newItem.paymentInfo!, accountNumber: e.target.value}})}
                        placeholder="000-0-00000-0"
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-[#5A5A40]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 ml-1">พร้อมเพย์ (Optional)</label>
                      <input 
                        value={newItem.paymentInfo?.promptpay}
                        onChange={e => setNewItem({...newItem, paymentInfo: {...newItem.paymentInfo!, promptpay: e.target.value}})}
                        placeholder="08X-XXX-XXXX"
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-[#5A5A40]"
                      />
                    </div>
                  </div>
                </div>

                {/* Location Picker Section */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ตำแหน่งที่ตั้งการค้า</label>
                    <button 
                      onClick={() => {
                        if (userLocation) {
                          setNewItem({ ...newItem, lat: userLocation.lat, lng: userLocation.lng });
                        }
                      }}
                      className="text-[10px] text-[#5A5A40] font-black underline"
                    >
                      ใช้ตำแหน่งปัจจุบัน
                    </button>
                  </div>
                  <div className="h-48 rounded-2xl overflow-hidden border border-gray-100 shadow-inner relative">
                    {GOOGLE_MAPS_API_KEY ? (
                      <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="weekly">
                        <Map
                          defaultCenter={{ lat: newItem.lat, lng: newItem.lng }}
                          defaultZoom={15}
                          mapId="MARKET_PICKER"
                          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                          gestureHandling={'greedy'}
                          disableDefaultUI={true}
                          onClick={(e) => {
                            if (e.detail.latLng) {
                              setNewItem({ ...newItem, lat: e.detail.latLng.lat, lng: e.detail.latLng.lng });
                            }
                          }}
                        >
                          <AdvancedMarker position={{ lat: newItem.lat, lng: newItem.lng }}>
                            <Pin background="#5A5A40" glyphColor="#fff" />
                          </AdvancedMarker>
                        </Map>
                      </APIProvider>
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center p-4 text-center">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-loose">
                          กรุณาตั้งค่า Google Maps API Key<br/>เพื่อใช้งานระบบแผนที่
                        </p>
                      </div>
                    )}
                  </div>
                  <input 
                    value={newItem.location}
                    onChange={e => setNewItem({...newItem, location: e.target.value})}
                    placeholder="ระบุชื่อพื้นที่ หรือจังหวัด..."
                    className="mt-2 w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-[#5A5A40] outline-none"
                  />
                </div>
              </div>

              <button 
                onClick={handleAddItem}
                className="w-full py-5 bg-[#5A5A40] text-white font-black rounded-3xl shadow-xl shadow-[#5A5A40]/20 active:scale-95 transition-all text-lg"
              >
                ลงประกาศขายทันที
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Purchase Confirmation Modal (Amazon-style Multi-step) */}
      <AnimatePresence>
        {purchaseItem && (
          <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setPurchaseItem(null); setCheckoutStep(1); }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-[40px] p-8 shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#5A5A40] text-white font-black text-xs">
                    {checkoutStep}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-[#1a1a1a]">
                      {checkoutStep === 1 ? 'ข้อมูลจัดส่ง' : 
                       checkoutStep === 2 ? 'การชำระเงิน' : 'ยืนยันการสั่งซื้อ'}
                    </h3>
                  </div>
                </div>
                <button onClick={() => { setPurchaseItem(null); setCheckoutStep(1); }} className="p-2 text-gray-300 hover:text-red-500">
                  <X className="w-8 h-8" />
                </button>
              </div>

              {/* Step Progress Bar */}
              <div className="flex gap-1 mb-6">
                {[1, 2, 3].map(s => (
                  <div key={s} className={cn(
                    "h-1 px-2 flex-1 rounded-full transition-all",
                    checkoutStep >= s ? "bg-[#5A5A40]" : "bg-gray-100"
                  )} />
                ))}
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar space-y-6">
                {checkoutStep === 1 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">รายละเอียดที่อยู่ (บ้านเลขที่, ซอย, ถนน)</label>
                      <input 
                        value={addressForm.detail}
                        onChange={e => setAddressForm({...addressForm, detail: e.target.value})}
                        placeholder="เช่น 123/45 หมู่บ้านไทยสุข ซอย 10 ถนนประชาชื่น"
                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">ตำบล/แขวง</label>
                        <input 
                          value={addressForm.subDistrict}
                          onChange={e => setAddressForm({...addressForm, subDistrict: e.target.value})}
                          placeholder="ตำบล"
                          className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">อำเภอ/เขต</label>
                        <input 
                          value={addressForm.district}
                          onChange={e => setAddressForm({...addressForm, district: e.target.value})}
                          placeholder="อำเภอ"
                          className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">จังหวัด</label>
                        <input 
                          value={addressForm.province}
                          onChange={e => setAddressForm({...addressForm, province: e.target.value})}
                          placeholder="จังหวัด"
                          className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">รหัสไปรษณีย์</label>
                        <input 
                          value={addressForm.zipcode}
                          onChange={e => setAddressForm({...addressForm, zipcode: e.target.value})}
                          placeholder="10XXX"
                          className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {checkoutStep === 2 && (
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">เลือกช่องทางการชำระเงิน</p>
                    <div className="space-y-3">
                      <button 
                        onClick={() => setPaymentMethod('cod')}
                        className={cn(
                          "w-full flex items-center gap-4 p-5 rounded-[28px] border-2 transition-all text-left",
                          paymentMethod === 'cod' ? "border-[#5A5A40] bg-[#5A5A40]/5" : "border-gray-100 hover:border-gray-200"
                        )}
                      >
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center",
                          paymentMethod === 'cod' ? "bg-[#5A5A40] text-white" : "bg-gray-100 text-gray-400"
                        )}>
                          <Banknote className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-black text-[#1a1a1a]">ชำระเงินปลายทาง (COD)</p>
                          <p className="text-[10px] text-gray-400 font-bold">จ่ายเงินเมื่อได้รับสินค้า</p>
                        </div>
                        {paymentMethod === 'cod' && <CheckCircle2 className="ml-auto w-6 h-6 text-[#5A5A40]" />}
                      </button>

                      <button 
                        onClick={() => setPaymentMethod('online')}
                        className={cn(
                          "w-full flex items-center gap-4 p-5 rounded-[28px] border-2 transition-all text-left",
                          paymentMethod === 'online' ? "border-[#5A5A40] bg-[#5A5A40]/5" : "border-gray-100 hover:border-gray-200"
                        )}
                      >
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center",
                          paymentMethod === 'online' ? "bg-[#5A5A40] text-white" : "bg-gray-100 text-gray-400"
                        )}>
                          <QrCode className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-black text-[#1a1a1a]">โอนชำระเงิน/Mobile Banking</p>
                          <p className="text-[10px] text-gray-400 font-bold">รองรับ PromptPay, K-Plus, SCB (โอนผ่านธนาคาร)</p>
                        </div>
                        {paymentMethod === 'online' && <CheckCircle2 className="ml-auto w-6 h-6 text-[#5A5A40]" />}
                      </button>
                    </div>
                  </div>
                )}

                {checkoutStep === 3 && (
                  <div className="space-y-6">
                    <div className="flex gap-4 bg-gray-50 p-4 rounded-3xl border border-gray-100">
                      <div className="w-20 h-20 bg-white rounded-2xl overflow-hidden shrink-0 shadow-sm border border-gray-100">
                        {purchaseItem.images?.[0] ? (
                          <img src={purchaseItem.images[0]} className="w-full h-full object-cover" />
                        ) : (
                          <ShoppingBag className="w-full h-full p-4 text-gray-200" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-[#1a1a1a] truncate">{purchaseItem.title}</h4>
                        <p className="text-[#5A5A40] font-black text-xl leading-none mt-1">฿{purchaseItem.price.toLocaleString()}</p>
                        <p className="text-[10px] text-gray-400 font-bold mt-2 truncate">จัดขายโดย: {purchaseItem.sellerName}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">การจัดส่ง</p>
                        <p className="text-[11px] font-bold text-gray-600 line-clamp-2">
                          {addressForm.province} {addressForm.zipcode}
                        </p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">ชำระเงิน</p>
                        <p className="text-[11px] font-bold text-gray-600">
                          {paymentMethod === 'cod' ? 'จ่ายปลายทาง' : 'โอนเงิน'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400 font-bold">ราคาสินค้า</span>
                        <span className="font-black">฿{purchaseItem.price.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400 font-bold">ค่าจัดส่ง</span>
                        <span className="font-black text-green-600">ฟรี</span>
                      </div>
                      <div className="pt-3 border-t border-dashed border-gray-200 flex items-center justify-between">
                        <span className="text-lg font-black text-[#1a1a1a]">รวมทั้งสิ้น</span>
                        <span className="text-2xl font-black text-[#5A5A40]">฿{purchaseItem.price.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-6">
                {checkoutStep > 1 && (
                  <button 
                    onClick={() => setCheckoutStep(prev => prev - 1)}
                    className="flex-1 py-4 bg-gray-100 text-gray-400 font-black rounded-2xl hover:bg-gray-200 transition-all uppercase tracking-widest text-xs"
                  >
                    ย้อนกลับ
                  </button>
                )}
                {checkoutStep < 3 ? (
                  <button 
                    onClick={() => {
                       if (checkoutStep === 1) {
                         const { detail, subDistrict, district, province, zipcode } = addressForm;
                         if (!detail || !subDistrict || !district || !province || !zipcode) {
                           alert("กรุณาระบุข้อมูลที่อยู่ให้ครบถ้วน");
                           return;
                         }
                       }
                       setCheckoutStep(prev => prev + 1);
                    }}
                    className="flex-[2] py-4 bg-[#5A5A40] text-white font-black rounded-2xl shadow-xl shadow-[#5A5A40]/20 active:scale-95 transition-all text-xs uppercase tracking-widest"
                  >
                    ต่อไป
                  </button>
                ) : (
                  <button 
                    onClick={() => handleBuy(purchaseItem)}
                    className="flex-[2] py-4 bg-[#5A5A40] text-white font-black rounded-2xl shadow-xl shadow-[#5A5A40]/20 active:scale-95 transition-all text-xs uppercase tracking-widest"
                  >
                    สั่งซื้อตอนนี้
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrder(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-[40px] p-8 shadow-2xl space-y-6 max-h-[95vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-[#1a1a1a]">รายละเอียดคำสั่งซื้อ</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Order ID: #{selectedOrder.id}</p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="p-2 text-gray-300 hover:text-red-500">
                  <X className="w-8 h-8" />
                </button>
              </div>

              {/* Status Header */}
              <div className="bg-gray-50 rounded-3xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-2xl flex items-center justify-center",
                    selectedOrder.status === 'pending' ? "bg-orange-100 text-orange-600" :
                    selectedOrder.status === 'confirmed' ? "bg-blue-100 text-blue-600" :
                    selectedOrder.status === 'shipped' ? "bg-purple-100 text-purple-600" :
                    selectedOrder.status === 'delivered' ? "bg-green-100 text-green-600" :
                    "bg-gray-100 text-gray-400"
                  )}>
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">สถานะปัจจุบัน</p>
                    <p className="font-black text-[#1a1a1a]">
                      {selectedOrder.status === 'pending' ? 'รอยืนยันจากผู้ขาย' :
                       selectedOrder.status === 'confirmed' ? 'ยืนยันแล้ว' :
                       selectedOrder.status === 'shipped' ? 'กำลังจัดส่ง' :
                       selectedOrder.status === 'delivered' ? 'ส่งแล้ว' : 'ยกเลิก'}
                    </p>
                  </div>
                </div>
                {selectedOrder.trackingNumber && (
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">เลขแทร็กกิ้ง</p>
                    <p className="font-mono text-xs font-black">{selectedOrder.trackingNumber}</p>
                  </div>
                )}
              </div>

              {/* Item Info */}
              <div className="flex gap-4 p-2">
                <div className="w-24 h-24 bg-gray-100 rounded-3xl overflow-hidden shrink-0">
                  {selectedOrder.itemImage ? (
                    <img src={selectedOrder.itemImage} className="w-full h-full object-cover" alt={selectedOrder.itemTitle} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBag className="w-8 h-8 text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 py-1">
                  <h4 className="text-xl font-black text-[#1a1a1a] line-clamp-1">{selectedOrder.itemTitle}</h4>
                  <p className="text-[#5A5A40] font-black text-lg">฿{selectedOrder.totalPrice.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 font-bold">จำนวน: 1 {selectedOrder.itemUnit || 'รายการ'}</p>
                </div>
              </div>

              {/* Buyer/Seller Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">ผู้ซื้อ</p>
                  <p className="font-bold text-sm truncate">{selectedOrder.buyerName || 'เกษตรกรไทย'}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">ผู้ขาย</p>
                  <p className="font-bold text-sm truncate">{selectedOrder.sellerName || 'เกษตรกรไทย'}</p>
                </div>
              </div>

              {/* Payment Info */}
              <div className="bg-[#5A5A40]/5 rounded-3xl p-4 flex items-center justify-between border border-[#5A5A40]/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#5A5A40] text-white flex items-center justify-center">
                    {selectedOrder.paymentMethod === 'cod' ? <Banknote className="w-5 h-5" /> : <QrCode className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">การชำระเงิน</p>
                    <p className="font-black text-sm text-[#1a1a1a]">
                      {selectedOrder.paymentMethod === 'cod' ? 'เก็บเงินปลายทาง' : 'โอนชำระเงิน'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">สถานะชำระ</p>
                  <p className={cn(
                    "text-[10px] font-black uppercase px-2 py-0.5 rounded-full",
                    selectedOrder.paymentStatus === 'paid' ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"
                  )}>
                    {selectedOrder.paymentStatus === 'paid' ? 'ชำระแล้ว' : 'รอชำระ'}
                  </p>
                </div>
              </div>

              {/* Bank Details for Online Payment */}
              {selectedOrder.paymentMethod === 'online' && selectedOrder.paymentStatus === 'pending' && selectedOrder.paymentInfo && (
                <div className="p-5 bg-blue-50/50 border border-blue-100 rounded-[28px] space-y-3">
                  <p className="text-[10px] text-blue-500 font-black uppercase tracking-widest flex items-center gap-2">
                    <Building2 className="w-3 h-3" />
                    ข้อมูลสำหรับการโอนเงิน
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[9px] text-gray-400 font-bold uppercase">ธนาคาร</p>
                      <p className="text-sm font-black text-blue-900">{selectedOrder.paymentInfo.bankName}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 font-bold uppercase">ชื่อบัญชี</p>
                      <p className="text-sm font-black text-blue-900">{selectedOrder.paymentInfo.accountName}</p>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-blue-100">
                      <p className="text-[9px] text-gray-400 font-bold uppercase">เลขบัญชี / พร้อมเพย์</p>
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-black text-blue-600 tabular-nums">
                          {selectedOrder.paymentInfo.accountNumber || selectedOrder.paymentInfo.promptpay}
                        </p>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(selectedOrder.paymentInfo!.accountNumber || selectedOrder.paymentInfo!.promptpay);
                            alert("คัดลอกเลขบัญชีแล้ว");
                          }}
                          className="px-3 py-1 bg-blue-100 text-blue-600 rounded-lg text-[10px] font-black hover:bg-blue-200 transition-colors"
                        >
                          คัดลอก
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-blue-400 font-bold italic">* เมื่อโอนแล้วกรุณารอผู้ขายยืนยันการรับเงิน</p>
                </div>
              )}

              {/* Shipping Address */}
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-2">
                    <Truck className="w-3 h-3" />
                    ที่อยู่จัดส่ง
                  </p>
                  <div className="bg-gray-50 rounded-2xl p-4 text-xs text-gray-600 leading-relaxed border border-gray-100 mt-2 space-y-1">
                    <p className="font-black text-gray-800">{selectedOrder.buyerName}</p>
                    <p>{selectedOrder.addressDetail}</p>
                    <p>ต.{selectedOrder.subDistrict} อ.{selectedOrder.district}</p>
                    <p>จ.{selectedOrder.province} {selectedOrder.zipcode}</p>
                  </div>
                </div>

                {/* Tracking Map View */}
                {selectedOrder.lat && selectedOrder.lng && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">ตำแหน่งต้นทาง/คลังสินค้า</p>
                    <div className="h-40 rounded-2xl overflow-hidden border border-gray-100 shadow-inner relative">
                      {GOOGLE_MAPS_API_KEY ? (
                        <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="weekly">
                          <Map
                            defaultCenter={{ lat: selectedOrder.lat, lng: selectedOrder.lng }}
                            defaultZoom={12}
                            mapId="ORDER_TRACKING_MAP"
                            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                            gestureHandling={'greedy'}
                            disableDefaultUI={true}
                          >
                            <AdvancedMarker position={{ lat: selectedOrder.lat, lng: selectedOrder.lng }}>
                              <Pin background="#5A5A40" glyphColor="#fff" borderColor="#fff">
                                <Truck className="w-4 h-4 text-white" />
                              </Pin>
                            </AdvancedMarker>
                          </Map>
                        </APIProvider>
                      ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center p-4">
                          <p className="text-[10px] text-gray-400 font-bold">Map unavailable</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {activeTab === 'sell' && selectedOrder.status === 'confirmed' && !selectedOrder.trackingNumber && (
                   <div className="pt-2">
                     <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">ระบุเลขแทร็กกิ้ง (Optional)</p>
                     <input 
                       placeholder="เช่น TH123456789"
                       className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-[#5A5A40]"
                       onBlur={async (e) => {
                         if (e.target.value) {
                            await updateDoc(doc(db, 'orders', selectedOrder.id), { 
                              trackingNumber: e.target.value,
                              updatedAt: serverTimestamp()
                            });
                         }
                       }}
                     />
                   </div>
                )}
              </div>

              {/* Status History */}
              <div className="space-y-4">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">ประวัติสถานะ</p>
                <div className="space-y-4 ml-2 border-l-2 border-gray-50 pl-6">
                  {selectedOrder.statusHistory?.map((h, i) => (
                    <div key={i} className="relative">
                      <div className="absolute -left-[29px] top-1 w-3 h-3 rounded-full bg-[#5A5A40] border-2 border-white shadow-sm" />
                      <div className="flex flex-col">
                        <p className="text-sm font-black text-[#1a1a1a]">
                          {h.status === 'pending' ? 'ส่งคำสั่งซื้อ' :
                           h.status === 'confirmed' ? 'ผู้ขายยืนยันคำสั่งซื้อ' :
                           h.status === 'shipped' ? 'ส่งสินค้าแล้ว' :
                           h.status === 'delivered' ? 'ได้รับสินค้าแล้ว' : 'ยกเลิก'}
                        </p>
                        <p className="text-[10px] text-gray-400 font-bold">
                          {h.timestamp?.toDate ? h.timestamp.toDate().toLocaleString('th-TH') : new Date(h.timestamp).toLocaleString('th-TH')}
                        </p>
                      </div>
                    </div>
                  )) || (
                    <p className="text-xs text-gray-400">ยังไม่มีประวัติสถานะ (คำสั่งซื้อเก่า)</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3 pt-2">
                {activeTab === 'sell' && selectedOrder.status === 'pending' && (
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => {
                        updateOrderStatus(selectedOrder.id, 'cancelled');
                        setSelectedOrder(null);
                      }}
                      className="py-4 bg-red-50 text-red-500 font-black rounded-2xl active:scale-95 transition-all text-[10px] uppercase tracking-widest"
                    >
                      ปฏิเสธคำสั่งซื้อ
                    </button>
                    <button 
                      onClick={() => {
                        updateOrderStatus(selectedOrder.id, 'confirmed');
                        setSelectedOrder(null);
                      }}
                      className="py-4 bg-[#5A5A40] text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all text-xs uppercase tracking-widest"
                    >
                      ยืนยันคำสั่งซื้อ
                    </button>
                  </div>
                )}
                
                {activeTab === 'sell' && selectedOrder.paymentMethod === 'online' && selectedOrder.paymentStatus === 'pending' && (
                  <button 
                    onClick={() => {
                      updatePaymentStatus(selectedOrder.id, 'paid');
                      setSelectedOrder(prev => prev ? {...prev, paymentStatus: 'paid'} : null);
                    }}
                    className="w-full py-4 bg-green-50 text-green-600 border border-green-100 font-black rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    ยืนยันการรับเงินโอนแล้ว
                  </button>
                )}

                {activeTab === 'sell' && selectedOrder.status === 'confirmed' && (
                   <div className="space-y-3">
                     {!selectedOrder.trackingNumber && (
                        <p className="text-[10px] text-orange-500 font-black text-center animate-pulse">กรุณาระบุเลขติดตามพัสดุก่อนจัดส่ง</p>
                     )}
                     <button 
                        disabled={!selectedOrder.trackingNumber}
                        onClick={() => {
                          updateOrderStatus(selectedOrder.id, 'shipped');
                          setSelectedOrder(null);
                        }}
                        className="w-full py-4 bg-[#5A5A40] text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all text-sm uppercase tracking-widest disabled:opacity-50 disabled:grayscale"
                      >
                        ยืนยันการส่งสินค้า
                      </button>
                   </div>
                )}
                {activeTab === 'my-orders' && selectedOrder.status === 'shipped' && (
                  <button 
                    onClick={() => {
                      updateOrderStatus(selectedOrder.id, 'delivered');
                      setSelectedOrder(null);
                    }}
                    className="w-full py-4 bg-green-600 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all"
                  >
                    ยืนยันได้รับสินค้าแล้ว
                  </button>
                )}
                {activeTab === 'my-orders' && selectedOrder.status === 'pending' && (
                  <button 
                    onClick={() => {
                      updateOrderStatus(selectedOrder.id, 'cancelled');
                      setSelectedOrder(null);
                    }}
                    className="w-full py-4 bg-gray-100 text-red-400 font-black rounded-2xl hover:bg-red-50 transition-all text-[10px] uppercase tracking-widest"
                  >
                    ยกเลิกคำสั่งซื้อ
                  </button>
                )}
                <button 
                  onClick={() => setSelectedOrder(null)}
                  className="w-full py-4 bg-gray-50 text-gray-400 font-black rounded-2xl hover:bg-gray-100 transition-all text-[10px] uppercase tracking-widest"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
