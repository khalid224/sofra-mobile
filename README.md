# sofra — تطبيق الموبايل (Enterprise Edition)
## React Native + Expo — إنتاجي كامل

---

## 🏗️ المعمارية

```
sofra-mobile/
├── app/                          # Expo Router (file-based routing)
│   ├── _layout.tsx               # Root: fonts, RTL, providers
│   ├── (tabs)/                   # Bottom navigation (5 tabs)
│   │   ├── index.tsx             # الرئيسية
│   │   ├── menu.tsx              # المنيو
│   │   ├── cart.tsx              # السلة
│   │   ├── orders.tsx            # طلباتي
│   │   └── account.tsx          # حسابي
│   ├── food/[id].tsx             # تفاصيل الصنف
│   ├── order/[id].tsx            # تتبع الطلب
│   ├── checkout/                 # إتمام الطلب
│   ├── auth.tsx                  # تسجيل الدخول/التسجيل
│   ├── search/                   # البحث
│   ├── chat/                     # المحادثات
│   ├── reviews/                  # تقييماتي
│   ├── complaints/               # شكاواي
│   ├── profile/                  # الملف الشخصي + العناوين
│   ├── admin.tsx                 # لوحة الإدارة (WebView)
│   └── contact.tsx               # اتصل بنا
│
├── src/
│   ├── features/                 # Feature-first architecture
│   │   ├── auth/api/             # Auth API layer
│   │   ├── menu/api/             # Catalog API
│   │   ├── orders/api/           # Orders API
│   │   ├── chat/api/             # Chat API
│   │   ├── reviews/api/          # Reviews API
│   │   ├── complaints/api/       # Complaints API
│   │   ├── profile/api/          # Profile + Addresses API
│   │   ├── home/api/             # Settings API
│   │   └── notifications/hooks/  # Push notifications
│   ├── components/
│   │   ├── ui/                   # Button, Input, Skeleton, EmptyState...
│   │   ├── shared/               # FoodCard, OrderStatusBadge, StarRating
│   │   └── layout/               # ScreenHeader
│   ├── contexts/                 # AuthContext, CartContext
│   ├── theme/                    # Tokens (oklch→hex), ThemeContext
│   ├── types/                    # Full domain types (no any)
│   ├── constants/                # App-wide constants
│   ├── utils/                    # Formatting, validation, helpers
│   ├── hooks/                    # useDebounce...
│   └── lib/                      # Supabase client, QueryClient, Errors
│
├── supabase/
│   ├── functions/
│   │   ├── place-order/          # Create order (validates prices server-side)
│   │   ├── send-push-notification/ # Expo push delivery
│   │   ├── update-order-status/  # Central status change service
│   │   └── assign-cook/          # Dispatch engine + WhatsApp URL
│   └── migrations/
│       ├── 0001_enterprise_schema.sql  # Full DB schema
│       ├── 0002_rls_policies.sql       # All RLS policies
│       └── 0003_push_triggers.sql      # DB → Push triggers
```

---

## ⚡ لماذا Expo/React Native وليس Capacitor؟

| المعيار | Expo RN | Capacitor |
|---|---|---|
| تجربة Native حقيقية | ✅ | ❌ WebView |
| Push Notifications | ✅ مباشر | يحتاج plugins معقدة |
| Google Sign-In Native | ✅ | WebView OAuth |
| الأداء | ✅ 60fps native | متعلق بالـ WebView |
| App Store Guidelines | ✅ مقبول | خطر رفض |
| Bottom Tabs، Haptics | ✅ Native | مقلّد CSS |

---

## 🚀 التشغيل المحلي

### المتطلبات
- Node.js 20+
- Expo CLI: `npm install -g expo-cli`
- حساب Expo: `npx expo login`

```bash
cd sofra-mobile
npm install
cp .env.example .env
# عبّئ .env بالقيم الصحيحة
npx expo start
```

افتح على جهازك: **Expo Go** (Android/iOS) أو:
```bash
npx expo run:ios      # Mac + Xcode مطلوب
npx expo run:android  # Android Studio مطلوب
```

---

## 🔧 متغيرات البيئة (.env)

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
GOOGLE_WEB_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_IOS_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
EXPO_PUBLIC_WEBSITE_URL=https://your-app.lovable.app
```

---

## 🗄️ إعداد Supabase (مرة واحدة)

### 1. تطبيق Migrations
افتح **SQL Editor** في لوحة Supabase وشغّل بالترتيب:
```
supabase/migrations/0001_enterprise_schema.sql
supabase/migrations/0002_rls_policies.sql
supabase/migrations/0003_push_triggers.sql
```

### 2. إعداد Triggers
بعد تطبيق migration 003:
```sql
ALTER DATABASE postgres SET app.settings.push_function_url =
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-push-notification';
ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
```

### 3. نشر Edge Functions
```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy place-order
npx supabase functions deploy send-push-notification
npx supabase functions deploy update-order-status
npx supabase functions deploy assign-cook
```

---

## 🔔 Push Notifications

يتم التسجيل تلقائياً بمجرد تسجيل دخول المستخدم عبر `useNotifications()` في `_layout.tsx`.

**الإشعارات تصل تلقائياً عند:**
| الحدث | المستلم |
|---|---|
| طلب جديد | كل المديرين |
| تغيير حالة الطلب | العميل |
| رد الإدارة في الشات | العميل |

> ⚠️ يحتاج جهاز حقيقي (لا يعمل على Simulator/Emulator)

---

## 🔐 Google Sign-In (تفعيل)

1. أنشئ OAuth Client IDs في [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. فعّل Google Provider في Supabase Auth Settings
3. في `app/auth.tsx`، فعّل الكود المعلّق:
```typescript
import { GoogleSignin } from '@react-native-google-signin/google-signin';
GoogleSignin.configure({ webClientId: process.env.GOOGLE_WEB_CLIENT_ID });
const { idToken } = await GoogleSignin.signIn();
await signInWithGoogle(idToken);
```
4. عدّل `app.json` → `ios.config.googleSignIn.reservedClientId`

---

## 📦 البناء والنشر (EAS)

```bash
# تسجيل الدخول لـ EAS
npx eas login
npx eas build:configure

# APK للتجربة (Android)
npx eas build --platform android --profile preview

# نسخة الإنتاج
npx eas build --platform android --profile production
npx eas build --platform ios --profile production

# رفع للمتاجر
npx eas submit --platform android
npx eas submit --platform ios
```

**المتطلبات:**
- Android: Google Play Console (25$ مرة واحدة)
- iOS: Apple Developer Program (99$/سنة) + App Store Connect

---

## 🎨 نظام الثيم

كل الألوان محوّلة من `oklch()` في `styles.css` إلى `hex` في `src/theme/tokens.ts`:
- **Primary:** Terracotta `#CA4B20` (light) / `#E8734A` (dark)
- **Accent:** Saffron `#CB9317`
- **Background:** Cream `#FAFAFA` (light) / `#0F0805` (dark)
- **Typography:** Cairo (Google Fonts) — Regular/Medium/SemiBold/Bold/ExtraBold

Dark mode محفوظ في `AsyncStorage` ويمكن التبديل من تبويب "حسابي".

---

## 📐 قواعد التطوير (Development Rules)

| القاعدة | الحالة |
|---|---|
| No TypeScript `any` | ✅ |
| No `select('*')` في الإنتاج | ✅ |
| Business logic في Backend | ✅ Edge Functions |
| RLS على كل الجداول | ✅ |
| Loading/Error/Empty states | ✅ لكل صفحة |
| كل DB change في migration | ✅ |
| No service_role في frontend | ✅ |
| Feature-first architecture | ✅ |
| Typed API responses | ✅ |

---

## 🔮 الخطوات القادمة (Phases التالية)

| Phase | المحتوى |
|---|---|
| 2 | Admin Dashboard كاملاً بـ Next.js (بدل WebView) |
| 3 | Dispatch Center Native screen |
| 4 | Cook Management Native |
| 5 | CRM + Customer Timeline |
| 6 | Delivery Management |
| 7 | Analytics Dashboard |
| 8 | Marketing: Coupons + Push Campaigns |
| 9 | Automation: Auto-assign, Reports |
| 10 | Multi-city, Multi-admin Scale |
