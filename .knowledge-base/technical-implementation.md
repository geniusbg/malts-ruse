# Technical Implementation Details

**Project:** Malts (malts-ruse.com)  
**Date:** October 2025

---

## 🏗️ Architecture

### **Frontend**
- **Framework:** Next.js 14+ with App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State:** React hooks (useState, useEffect)
- **Routing:** File-based routing with locale prefix
- **Images:** Native `<img>` tags (unoptimized for local files)

### **Backend**
- **Database:** PostgreSQL 
  - Host: 66.29.142.10
  - Database: malts (PostgreSQL user + database name)
- **ORM:** Prisma
- **File Storage:** Local (`/public/uploads/`)
- **Real-time:** Pusher Channels

### **Internationalization**
- **Library:** next-intl
- **Locales:** bg (default), en, ro
- **Routing:** Locale prefix (`/bg/`, `/en/`, `/ro/`)
- **Exceptions:** `/order` and `/uploads` routes excluded from i18n

---

## 📦 Database Schema

### **Core Models**

**Category**
- Multi-language names (bg, en, de)
- Slug for URLs
- Order (sort position)
- Timestamps

**Product**
- Multi-language (names, descriptions)
- Category relationship
- Prices (BGN, EUR)
- Image URL
- Visibility flags:
  - `isAvailable` - show with "unavailable" badge
  - `isHidden` - completely hide from menu
  - `isFeatured` - show star icon
- Order position
- Allergens array
- Timestamps

**BarTable**
- Table number (1-30)
- Table name
- QR code data (base64 image)
- QR code URL
- Timestamps

**Order**
- Order number (auto-increment)
- Table number
- Status (pending, preparing, ready, completed)
- Total (BGN, EUR)
- Completed timestamp
- Order items (relation)
- Timestamps

**OrderItem**
- Product reference
- Product name (snapshot)
- Quantity
- Price (snapshot)
- Order relation

**WaiterCall**
- Table number
- Call type (payment_cash, payment_card, help)
- Message
- Status (pending, acknowledged, completed)
- Completed timestamp
- Timestamps

**Event**
- Multi-language (title, description)
- Date & time
- Location
- Image URL
- Is published
- Is external (partner event)
- Timestamps

**Staff** (for future auth)
- Name, email, phone
- Role
- Is active

**HypeSyncLog** (for future POS integration)
- Action type
- Details
- Success status
- Timestamps

---

## 🔌 API Architecture

### **RESTful Endpoints**

**Products:**
- `GET /api/products` - List all
- `POST /api/products` - Create
- `GET /api/products/[productRef]` - Get one (`productRef` = slug or UUID)
- `PUT /api/products/[productRef]` - Update
- `DELETE /api/products/[productRef]` - Delete

**Categories:**
- `GET /api/categories` - List all
- `POST /api/categories` - Create
- `PUT /api/categories/[id]` - Update
- `DELETE /api/categories/[id]` - Delete (validates no products)

**Orders:**
- `POST /api/orders/create` - Create order (triggers Pusher)
- `GET /api/orders/all` - All orders today
- `GET /api/orders/active` - Active orders
- `GET /api/orders/completed` - Completed orders
- `PATCH /api/orders/[id]/status` - Update status

**Waiter Calls:**
- `POST /api/waiter-call` - Create call (triggers Pusher)
- `GET /api/waiter-call/all` - All calls today
- `PATCH /api/waiter-call/[id]/acknowledge` - Acknowledge
- `PATCH /api/waiter-call/[id]/complete` - Complete

**QR Codes:**
- `GET /api/qr/generate` - Generate all QR codes
- `POST /api/qr/generate` - Generate single QR code

**Other:**
- `POST /api/upload` - Image upload
- `GET /api/menu` - Public menu data
- `GET /api/tables` - All tables with QR codes
- `GET /api/events` - Events
- `POST /api/events` - Create event

### **POS Integration (Ready, not active)**
- `POST /api/pos/products/sync` - Sync from Hype
- `POST /api/pos/products/batch-update` - Batch update
- `PATCH /api/pos/products/[id]/availability` - Update availability

---

## 🔄 Real-time System

### **Pusher Configuration**
- **Channel:** `staff-channel`
- **Events:**
  - `new-order` - New order created
  - `waiter-call` - Waiter called

**Flow:**
1. Customer submits order/call
2. API creates database record
3. API triggers Pusher event
4. Staff dashboard receives event instantly
5. Sound alert plays
6. Notification popup appears

---

## 🖼️ Image Handling

### **Upload Process**
1. Customer selects image in ProductForm/EventForm
2. ImageUpload component uploads to `/api/upload`
3. File saved to `/public/uploads/[timestamp]-[random].[ext]`
4. API returns URL: `/uploads/filename.jpg`
5. URL stored in database
6. Images served statically from `/uploads`

### **Middleware Configuration**
- `/uploads` excluded from locale routing
- Direct access: `/uploads/image.jpg` (no `/bg/` prefix)

### **Image Display**
- **Menu:** Product images (200x150px approx)
- **Admin list:** Thumbnails (64x64px)
- **Admin form:** Preview (full size)
- **Events:** Featured images

---

## 🎨 UI/UX Patterns

### **Toast Notifications**
- **Component:** `components/Toast.tsx`
- **Types:** Success (green), Error (red), Info (blue)
- **Duration:** 4 seconds auto-dismiss
- **Position:** Top-right, fixed
- **Animation:** Slide-in from right
- **Features:** Progress bar, manual close

### **Loading States**
- **Spinners:** Rotating border animation
- **Disabled buttons:** Opacity 50%, cursor not-allowed
- **Text:** "Зареждане...", "Изпращане...", etc.
- **Overlays:** For button actions

### **Color Scheme**
- **Primary:** Purple (`#9333ea`)
- **Secondary:** Pink (`#ec4899`)
- **Background:** Slate-900 with purple-900 gradient
- **Text:** White, purple-200, purple-300
- **Success:** Green-500
- **Error:** Red-500
- **Warning:** Yellow-500

### **Animations**
- `bounce-in` - Notifications appear
- `slide-in` - Toasts enter
- `progress` - Progress bar
- `spin` - Loading spinners
- `grayscale` - Unavailable products

---

## 🔐 Security Considerations

### **Current State**
- ⚠️ No authentication implemented
- ⚠️ Admin panel publicly accessible
- ⚠️ API routes unprotected

### **For Production (TODO)**
- Implement authentication (Supabase Auth or NextAuth)
- Protect admin routes with middleware
- API key validation for POS integration
- Rate limiting on public endpoints
- Input validation & sanitization
- SQL injection protection (Prisma handles this)
- XSS protection

---

## 🚀 Deployment Readiness

### **Environment Variables Required**
```env
DATABASE_URL=postgresql://...
NEXT_PUBLIC_APP_URL=https://malts-ruse.com
NEXT_PUBLIC_PUSHER_KEY=...
NEXT_PUBLIC_PUSHER_CLUSTER=...
PUSHER_APP_ID=...
PUSHER_SECRET=...
```

### **Build Process**
1. `npm install`
2. `npx prisma generate`
3. `npx prisma db push` (or run migration SQL)
4. `npm run build`
5. `npm start`

### **Pre-deployment Checklist**
- ✅ Database migrated
- ✅ Seed data added (categories, tables)
- ⏳ Environment variables configured
- ⏳ Production domain set
- ⏳ Pusher production credentials
- ⏳ Authentication implemented
- ⏳ SSL certificate

---

## 📊 Performance Optimizations

### **Implemented**
- ✅ Client-side rendering for interactive pages
- ✅ Server-side rendering for static content
- ✅ Parallel data fetching (`Promise.all`)
- ✅ Optimized database queries (indexes)
- ✅ Efficient state management

### **Potential Improvements**
- ⏳ Image optimization (WebP conversion)
- ⏳ CDN for images
- ⏳ Redis caching for menu data
- ⏳ Database connection pooling
- ⏳ Static page generation where possible

---

## 🐛 Known Issues & Limitations

### **Minor Warnings (Non-breaking)**
- `params` deprecation warnings in Next.js 15
  - Fixed in most components with `usePathname()`
  - Remaining in server components (works for now)

### **Limitations**
- **No authentication** - admin panel open to all
- **No email notifications** - only in-app
- **No SMS** - only web notifications
- **No analytics** - basic stats only
- **No inventory management** - manual only
- **No POS integration** - endpoints ready, not connected

### **Browser Requirements**
- Modern browser with JavaScript enabled
- LocalStorage support (for language preference)
- Camera for QR code scanning

---

## 🔧 Development Tools

### **Scripts**
- `npm run dev` - Development server
- `npm run build` - Production build
- `npm start` - Production server
- `npx prisma studio` - Database GUI
- `npx prisma generate` - Generate Prisma client

### **Database Tools**
- Prisma Studio for visual DB management
- Direct SQL via `psql` or pgAdmin

---

**Last Updated:** 2025-10-16  
**Status:** ✅ Functional implementation complete

