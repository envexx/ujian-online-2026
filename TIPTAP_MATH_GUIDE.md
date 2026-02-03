# 📐 TipTap Mathematics - Complete Guide

## ✨ Auto-Detection Support

TipTap sekarang otomatis mendeteksi dan render **SEMUA** expresi matematika saat paste!

---

## 🎯 Supported LaTeX Patterns

### 1. **Fractions & Roots**
```
\frac{a}{b}              → a/b
\dfrac{1}{2}             → ½ (display style)
\sqrt{x}                 → √x
\sqrt[3]{8}              → ∛8
```

### 2. **Greek Letters**
```
\alpha, \beta, \gamma    → α, β, γ
\delta, \epsilon, \zeta  → δ, ε, ζ
\theta, \lambda, \mu     → θ, λ, μ
\pi, \sigma, \omega      → π, σ, ω
\Gamma, \Delta, \Omega   → Γ, Δ, Ω
```

### 3. **Operators**
```
\times                   → ×
\div                     → ÷
\pm, \mp                 → ±, ∓
\cdot                    → ·
\ast, \star              → ∗, ⋆
```

### 4. **Relations**
```
\leq, \geq               → ≤, ≥
\neq                     → ≠
\approx, \sim            → ≈, ∼
\equiv                   → ≡
\propto                  → ∝
```

### 5. **Arrows**
```
\rightarrow, \leftarrow  → →, ←
\Rightarrow, \Leftarrow  → ⇒, ⇐
\leftrightarrow          → ↔
\uparrow, \downarrow     → ↑, ↓
```

### 6. **Calculus**
```
\int f(x)dx              → ∫ f(x)dx
\sum_{i=1}^{n}           → Σ (with limits)
\prod_{i=1}^{n}          → Π (with limits)
\lim_{x \to \infty}      → lim with arrow
\partial, \nabla         → ∂, ∇
```

### 7. **Trigonometry & Logarithms**
```
\sin, \cos, \tan         → sin, cos, tan
\arcsin, \arccos         → arcsin, arccos
\sinh, \cosh, \tanh      → sinh, cosh, tanh
\log, \ln, \exp          → log, ln, exp
```

### 8. **Set Theory**
```
\in, \notin              → ∈, ∉
\subset, \supset         → ⊂, ⊃
\cup, \cap               → ∪, ∩
\emptyset, \varnothing   → ∅
\forall, \exists         → ∀, ∃
```

### 9. **Logic**
```
\land, \lor, \lnot       → ∧, ∨, ¬
\implies, \iff           → ⇒, ⇔
```

### 10. **Accents & Decorations**
```
\hat{x}, \bar{x}         → x̂, x̄
\vec{v}                  → v⃗
\dot{x}, \ddot{x}        → ẋ, ẍ
\tilde{x}                → x̃
\overline{AB}            → AB̅
\underline{text}         → text (underlined)
```

### 11. **Brackets & Delimiters**
```
\left( ... \right)       → Auto-sized ()
\left[ ... \right]       → Auto-sized []
\left\{ ... \right\}     → Auto-sized {}
\langle, \rangle         → ⟨, ⟩
```

### 12. **Superscripts & Subscripts**
```
x^2, x^{10}              → x², x¹⁰
x_1, x_{20}              → x₁, x₂₀
a^2 + b^2 = c^2          → Pythagorean theorem
```

### 13. **Matrices**
```
\begin{matrix}
  a & b \\
  c & d
\end{matrix}

\begin{pmatrix}          → Matrix with ()
\begin{bmatrix}          → Matrix with []
\begin{vmatrix}          → Determinant with ||
```

### 14. **Special Symbols**
```
\infty                   → ∞
\angle, \triangle        → ∠, △
\square, \diamond        → □, ◊
\therefore, \because     → ∴, ∵
```

---

## 📋 Usage Examples

### **Example 1: Quadratic Formula**
Paste:
```
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
```
Result: Auto-rendered! ✅

### **Example 2: Pythagorean Theorem**
Paste:
```
a^2 + b^2 = c^2
```
Result: Auto-rendered! ✅

### **Example 3: Integral**
Paste:
```
\int_{0}^{\infty} e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
```
Result: Auto-rendered! ✅

### **Example 4: Sum Series**
Paste:
```
\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}
```
Result: Auto-rendered! ✅

### **Example 5: Greek Letters**
Paste:
```
\alpha + \beta = \gamma
```
Result: Auto-rendered! ✅

### **Example 6: Matrix**
Paste:
```
\begin{pmatrix}
  1 & 2 \\
  3 & 4
\end{pmatrix}
```
Result: Auto-rendered! ✅

---

## 🎨 Formatting in TipTap

### **Inline Math (dalam kalimat):**
AI output: `"Nilai $x^2$ adalah..."`
Display: "Nilai x² adalah..."

### **Display Math (terpisah):**
AI output: `"$$\frac{a}{b}$$"`
Display: Large centered fraction

### **Mixed Content:**
AI output: `"Koefisien $a^2$ dan $b^2$ dari $3a^2-2a+4b$ adalah..."`
Display: "Koefisien a² dan b² dari 3a²−2a+4b adalah..."

---

## 🚀 Pro Tips

### **1. Copy-Paste LaTeX**
- Copy formula dari anywhere
- Paste ke TipTap → Auto-detect & render!
- No need untuk manual wrap dengan `$`

### **2. Use Math Button (Σ)**
- Klik button Σ di toolbar
- Input LaTeX formula
- Enter → Instant render!

### **3. Edit Existing Formula**
- Klik pada rendered formula
- Edit LaTeX code
- Klik OK → Re-render!

### **4. AI Extract**
- Import PDF dengan matematika
- AI auto-extract dengan `$` delimiters
- Auto-render saat load!

---

## 🔧 Technical Details

### **Detection Algorithm:**
1. Check for LaTeX commands (`\frac`, `\sqrt`, etc)
2. Check for superscripts (`^`) and subscripts (`_`)
3. Check for Greek letters and symbols
4. Check for math operators
5. If detected → Auto-wrap → Render with KaTeX

### **Priority:**
1. **handlePaste** (paste event) → Direct insertion
2. **transformPastedHTML** → HTML processing
3. **transformPasted** → Slice processing

### **Extensions Chain:**
```
MathDelimiterParser (detect & parse)
  ↓
Mathematics (math nodes)
  ↓
KaTeX (rendering)
```

---

## 📚 References

- [KaTeX Supported Functions](https://katex.org/docs/supported.html)
- [LaTeX Math Symbols](https://www.latex-project.org/help/documentation/)
- [TipTap Mathematics Extension](https://tiptap.dev/docs/editor/extensions/nodes/mathematics)

---

**Made with ❤️ for E-Learning Platform**











