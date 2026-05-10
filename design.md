# Dividown Design System & Style Guide

This document outlines the **"Quiet Luxury"** design philosophy used in Dividown, reflecting a preference for premium, data-focused, and highly polished user interfaces.

## 1. Design Philosophy: "Quiet Luxury"
The "Quiet Luxury" aesthetic is characterized by:
- **Understated Elegance**: Avoiding flashy elements in favor of refined typography and generous spacing.
- **Data Clarity**: Presenting complex financial data through a clean lens, using color and icons only when they provide functional meaning.
- **Tactile Feedback**: Subtle micro-interactions (scale-down on click, hover-lift) that make the interface feel responsive and high-quality.
- **Glassmorphism**: Selective use of blur and transparency to create depth without visual noise.

---

## 2. Visual Foundation

### Typography
- **Primary Font**: `Plus Jakarta Sans` (Modern, geometric, and energetic).
- **Headings**: `font-extrabold` or `font-black` with `tracking-tight` for a strong, premium presence.
- **Metadata/Labels**: `font-bold`, `text-[10px]`, `uppercase`, and `tracking-widest` to create a sophisticated, "luxury tag" feel.
- **Body**: `antialiased` with `font-feature-settings: "cv02", "cv03", "cv04", "cv11"` for improved legibility on high-res screens.

### Color Palette
| Category | Variable / Color | Usage |
| :--- | :--- | :--- |
| **Primary** | Indigo 600 (`#4f46e5`) | Brand color, main CTAs, active states. |
| **Neutral** | Slate 50-950 | Backgrounds (50), Borders (200), Text (900). |
| **Success** | Emerald 500/600 | Dividends, positive returns, "Pulih" status. |
| **Danger** | Rose 500/600 | Dividend Traps, capital loss, bearish signals. |
| **Accent** | Indigo 50/10 | Subtle hover backgrounds and focus rings. |

---

## 3. UI Components & Patterns

### Containers & Surfaces
- **Main Cards**: `bg-white`, `border-slate-200/80`, `rounded-2xl` (16px).
- **Glass Panels**: `bg-white/70`, `backdrop-blur-lg`, `border-white/20`.
- **Shadows**: Soft, colored shadows (e.g., `shadow-indigo-500/20`) used only on hover or active elements to denote depth.

### Buttons
- **Primary**: Solid Indigo, rounded-xl, bold text. Features a slight scale-down (`active:scale-95`) on click.
- **Secondary**: Outlined Slate, becoming Indigo on hover. Used for auxiliary actions.
- **Pill**: Small, high-contrast labels (e.g., Sector filters) with wide letter spacing.

### Form Inputs
- **Interactive Controls**: Large, rounded-2xl inputs with icons (`Wallet`, `Search`).
- **Focus States**: Indigo border with a subtle, wide focus ring (`focus:ring-indigo-600/20`).
- **Toggles**: Segmented controls (e.g., Lumpsum vs DCA) that feel like physical sliders.

---

## 4. Interaction Design (IX)

### Animations
- **Entrance**: `fadeInUp` (0.6s) with a custom cubic-bezier for a smooth "sliding in" effect.
- **Loading**: Custom shimmer skeletons that match the exact layout of the target component to reduce layout shift.
- **Transitions**: Global `duration-300 ease-out` for all hover and state changes.

### Micro-interactions
- **Hover Lift**: `.hover-lift` class adds `-translate-y-1` and a soft shadow.
- **Click Feedback**: Standardized `active:scale-95` on all interactive elements (buttons, cards, icons).

---

## 5. Implementation Guidelines

- **Tailwind First**: Use native Tailwind utility classes. Avoid custom CSS unless for complex animations.
- **Utility Layers**:
    - `@layer base`: Typography and global resets.
    - `@layer components`: Reusable patterns (`btn-primary`, `glass-panel`).
    - `@layer utilities`: One-off helpers and animations.
- **Mobile-First**: Design for 390x844px first. Ensure large tap targets (min 44x44px) and clear visual hierarchy.
- **No Placeholders**: Use shimmer skeletons or meaningful icons instead of generic loading spinners.

---

## 6. Personal Taste Notes
Based on our project history, you value:
1. **Precision in Data**: Preference for Median over Mean where it prevents outlier distortion.
2. **Professionalism**: Even "Error" or "Maintenance" states must look premium and intentional.
3. **Cleanliness**: Hiding complex controls (like the simulation panel) behind collapses on mobile to save space.
4. **Consistency**: Reusing the same "Health Score" and "Badge" patterns across different pages to build a mental model.
