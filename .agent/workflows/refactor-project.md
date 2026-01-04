---
description: إعادة هيكلة المشروع - تنظيم الكود وتقسيم الملفات
---

# خطة إعادة هيكلة مشروع VidScholar

## 1. تقسيم CSS إلى وحدات

### الملفات الجديدة:
```
entrypoints/content/styles/
├── index.css           # الملف الرئيسي (يستورد كل الملفات)
├── base.css            # Reset و Base styles
├── buttons.css         # جميع أنواع الأزرار
├── toolbar.css         # Main و Sub Toolbar
├── dialogs.css         # Prompt, Confirm, Import Decision
├── modals.css          # Template Editor, Video Manager
├── sidebar.css         # Sidebar و Notes Container
├── notes.css           # Note cards و textarea
├── forms.css           # Inputs, selects, checkboxes
├── toast.css           # Toast notifications
├── animations.css      # Keyframes و transitions
└── utilities.css       # Utility classes
```

## 2. إنشاء Barrel Exports

### ملفات index.ts الجديدة:
```
src/
├── components/
│   ├── index.ts        # تصدير جميع المكونات
│   ├── modals/index.ts
│   ├── toolbar/index.ts
│   ├── notes/index.ts
│   └── ui/index.ts
├── services/
│   └── index.ts        # تصدير جميع الخدمات
├── utils/
│   └── index.ts        # تصدير جميع الـ utilities
└── classes/
    └── index.ts        # تصدير جميع الـ classes
```

## 3. تنظيم Constants

### ملف جديد: src/constants/index.ts
- STORAGE_KEYS
- CSS_CLASSES
- EVENT_NAMES
- DEFAULT_VALUES
- ERROR_MESSAGES

## 4. إنشاء Hooks Directory

### مجلد جديد: src/hooks/
- useTheme.ts
- useLanguage.ts
- useNotes.ts
- useKeyboard.ts

## 5. تحسين Types

### تقسيم types/index.ts:
```
src/types/
├── index.ts            # يستورد ويصدر كل الأنواع
├── note.types.ts       # Note, StoredVideoData
├── app.types.ts        # AppState, Theme
├── settings.types.ts   # UserSettings
├── export.types.ts     # Export/Import types
└── guards.ts           # Type guards
```

## خطوات التنفيذ:

// turbo-all

1. إنشاء مجلد styles وتقسيم CSS
2. تحديث ملف content.ts للاستيراد من index.css
3. إنشاء barrel exports للمكونات
4. إنشاء barrel exports للخدمات
5. إنشاء ملف constants
6. تقسيم ملف types
7. اختبار البناء للتأكد من عدم وجود أخطاء
