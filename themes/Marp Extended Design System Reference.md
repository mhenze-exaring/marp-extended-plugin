---
marp: true
theme: meds-reference-v0.2
paginate: true
header: MEDS Reference
footer: Marp Extended Design System v0.2
created: 2025-12-16T19:49
updated: 2025-12-21T18:53
---

<!-- _class: lead -->
<!-- _paginate: false -->
<!-- _header: "" -->
<!-- _footer: "" -->

# MEDS - Marp Extended Design System

## A Universal Reference for Consistent Presentations

**Version 0.2** | Reference Documentation

---

# Table of Contents

1. **Architecture Overview** - System structure and CSS variables
2. **Moods** - Emotional slide atmospheres (8 moods)
3. **Slide Layouts** - Structural layouts (11) and content types (8)
4. **Container Components** - Reusable content blocks (15 components)
5. **Modifiers** - Size, emphasis, and position modifiers
6. **Combinations** - Real-world usage examples
7. **For AI Usage** - Guidelines for automated generation
8. **Theme Creation** - How to create new themes
9. **Advanced Container Syntax** - Extended `:::` container features
10. **AI Generation: Container Patterns** - Best practices for containers

---

<!-- _class: section confident -->

# 1. Architecture Overview

Understanding the layered CSS variable system

---

## Three-Layer Architecture

The design system uses a hierarchical approach to CSS variables:

```
LAYER 1: Primitives       → Raw values (colors, fonts, spacing)
           ↓
LAYER 2: Semantic Tokens  → Context-aware (--accent-1, --surface, --fg)
           ↓
LAYER 3: Component Tokens → Component-specific (--callout-border)
```

**Key Principle:** Components only reference Layer 2/3 tokens, never primitives.
This allows moods to change the entire slide appearance by overriding Layer 2.

---

## Contrast Requirements (WCAG)

Themes must maintain these minimum contrast ratios:

| Relationship | Ratio | Standard |
|--------------|-------|----------|
| `--bg` → `--fg` | 7:1 | AAA (normal text) |
| `--bg` → `--accent-1` | 4.5:1 | AA (normal text) |
| `--bg` → `--fg-muted` | 3:1 | AA (large text) |
| `--surface` → `--fg` | 7:1 | AAA |

---

## Lightness Scale Reference

| Token                | Dark Theme | Light Theme |
| -------------------- | ---------- | ----------- |
| `--bg`               | 5-10%      | 95-100%     |
| `--surface`          | 10-15%     | 90-95%      |
| `--surface-elevated` | 15-20%     | 85-90%      |
| `--border`           | 25-35%     | 70-80%      |
| `--fg-muted`         | 45-55%     | 50-60%      |
| `--fg`               | 90-100%    | 5-15%       |

---

<!-- _class: section energetic -->

# 2. Moods

Emotional atmospheres for slides

---

## Mood Overview

Moods set the emotional tone of a slide through color and atmosphere.
Apply with `<!-- _class: mood-name -->` for single slides.

| Mood        | Emotion               | Use Case               |
| ----------- | --------------------- | ---------------------- |
| `neutral`   | Factual, professional | Default, data, facts   |
| `confident` | Trustworthy, stable   | Corporate, data-heavy  |
| `energetic` | Dynamic, activating   | Launches, CTAs         |
| `success`   | Positive, growth      | Achievements, results  |
| `warning`   | Attention, caution    | Risks, notices         |
| `danger`    | Critical, urgent      | Problems, errors       |
| `premium`   | Luxurious, exclusive  | Executive, high-end    |
| `calm`      | Relaxed, reflective   | Summaries, conclusions |

---

<!-- _class: neutral -->

## Mood: Neutral

The default mood. Professional, factual, unbiased.

**Best for:**
- Data presentations
- Factual information
- Neutral comparisons
- Technical documentation

**Colors:** Blue-grey, balanced contrast, no strong accents

---

<!-- _class: confident -->

## Mood: Confident

Builds trust through stable, professional blue tones.

**Best for:**
- Corporate presentations
- Financial reports
- Investor updates
- Company overviews

**Colors:** Deep blues, professional feel, trust-building

---

<!-- _class: energetic -->

## Mood: Energetic

Dynamic and activating with warm orange tones.

**Best for:**
- Product launches
- Call-to-actions
- Marketing pitches
- Exciting announcements

**Colors:** Orange/amber, warm, action-oriented

---

<!-- _class: success -->

## Mood: Success

Positive atmosphere celebrating achievements.

**Best for:**
- Results presentations
- Goal achievements
- Growth metrics
- Positive outcomes

**Colors:** Green tones, growth-oriented, positive

---

<!-- _class: warning -->

## Mood: Warning

Draws attention without alarm.

**Best for:**
- Risk assessments
- Important notices
- Cautionary information
- Deprecation warnings

**Colors:** Amber/yellow, attention-grabbing, not alarming

---

<!-- _class: danger -->

## Mood: Danger

Communicates urgency and critical importance.

**Best for:**
- Critical issues
- Error states
- Security warnings
- Breaking changes

**Colors:** Red tones, urgent, critical

---

<!-- _class: premium -->

## Mood: Premium

Luxurious and exclusive feel.

**Best for:**
- Executive presentations
- High-end products
- VIP communications
- Premium offerings

**Colors:** Deep purple/black with gold accents

---

<!-- _class: calm -->

## Mood: Calm

Relaxed, reflective atmosphere.

**Best for:**
- Summary slides
- Conclusion sections
- Reflective content
- Thank you slides

**Colors:** Teal/blue-green, soft, soothing

---

<!-- _class: section confident -->

# 3. Slide Layouts

Structural and content-type layouts

---
/// small

## Structural Layouts Overview

| Layout          | Description                  |
| --------------- | ---------------------------- |
| `lead`          | Centered title slide         |
| `section`       | Chapter divider              |
| `columns`       | Two columns, no divider      |
| `split`         | Two columns with divider     |
| `thirds`        | Three equal columns          |
| `sidebar-left`  | Narrow left + wide right     |
| `sidebar-right` | Wide left + narrow right     |
| `image-left`    | Image left, text right       |
| `image-right`   | Text left, image right       |
| `image-full`    | Full background with overlay |
| `blank`         | No padding, raw canvas       |

---

<!-- _class: lead -->

# Lead Layout

Centered title for presentations and chapters

**Perfect for:** Opening slides, chapter transitions

---

<!-- _class: section -->

# Section Layout

## Left-aligned chapter dividers

Less prominent than lead, good for subsections

---

<!-- _class: columns -->

## Columns Layout

::: col
### Left Column

Content flows naturally in two equal columns without visual separation.

- Point A
- Point B
- Point C
  :::

::: col
### Right Column

Good for parallel information, comparisons, or related content.

- Point X
- Point Y
- Point Z
  :::

---

<!-- _class: split -->

## Split Layout

::: col
### With Divider

The split layout includes a gradient divider between columns.

Creates visual separation.
:::

::: col
### Right Side

Good for clear before/after or pro/con comparisons.

Strong visual distinction.
:::

---

<!-- _class: thirds -->

## Thirds Layout

::: col
### Column 1

First of three equal columns.
:::

::: col
### Column 2

Middle column content.
:::

::: col
### Column 3

Third column content.
:::

---

## Content-Type Layouts

| Layout       | Description                       |
| ------------ | --------------------------------- |
| `quote`      | Large centered quote              |
| `comparison` | Side-by-side with colored headers |
| `timeline`   | Horizontal timeline               |
| `process`    | Numbered step sequence            |
| `agenda`     | Table of contents                 |
| `team`       | People grid                       |
| `metrics`    | KPI dashboard                     |
| `code`       | Optimized for code display        |

---

<!-- _class: quote -->

> Design is not just what it looks like and feels like. Design is how it works.

<cite>Steve Jobs</cite>

---

<!-- _class: comparison -->

## Comparison Layout

::: col
### Before

- Manual process
- Error-prone
- Time-consuming
- Inconsistent results
  :::

::: col
### After

- Automated workflow
- Reliable
- Fast execution
- Consistent output
  :::

---

<!-- _class: process -->

## Process Layout

1. **Research** - Gather requirements and understand context
2. **Design** - Create wireframes and mockups
3. **Build** - Implement the solution
4. **Test** - Validate and iterate

---

<!-- _class: agenda -->

# Agenda

1. Introduction and Overview
2. Technical Architecture
3. Implementation Details
4. Demo and Examples
5. Q&A Session

---

<!-- _class: metrics -->

## Metrics Layout

::: metric
**2.5M**
Active Users
:::

::: metric
**99.9%**
Uptime
:::

::: metric
**<50ms**
Response Time
:::

::: metric
**4.8/5**
User Rating
:::

---

<!-- _class: code small -->

## Code Layout

```javascript
// The code layout optimizes for code display
const designSystem = {
  moods: ['neutral', 'confident', 'energetic', 'success',
          'warning', 'danger', 'premium', 'calm'],
  layouts: {
    structural: ['lead', 'section', 'columns', 'split'],
    content: ['quote', 'comparison', 'process', 'metrics']
  },

  applyMood(slide, mood) {
    slide.classList.add(mood);
    this.updateSemanticTokens(slide, mood);
  }
};
```

---

<!-- _class: section success -->

# 4. Container Components

Reusable content blocks

---

## Container Overview

Containers are applied using the markdown-it-container syntax:

```markdown
::: container-name [modifiers]
Content here
:::
```

| Category | Components |
|----------|------------|
| **Text** | caption, callout, aside, quote, note, badge |
| **Structural** | card, box, panel, steps, col |
| **Data** | metric, stat |
| **Visual** | figure, diagram, code-block |

---
## Nested Containers

When nesting containers, **add one colon per nesting level**:

```markdown
:::: col                          <!-- Outer: 4 colons -->
### Column Title

Some text here.

::: callout warning               <!-- Inner: 3 colons -->
Nested callout inside a column
:::

::::                              <!-- Close outer: 4 colons -->
```

**Rules:**
- Standard container: `:::` (3 colons)
- First nesting level: `::::` (4 colons)
- Second nesting level: `:::::` (5 colons)
- Opening and closing must match

---

## Caption

Small annotations and descriptions.

::: caption
This is a caption - used for annotations, image descriptions, or footnotes.
:::

::: caption small
A smaller caption variant for less prominent notes.
:::

::: caption bottom-right
Positioned caption (requires absolute positioning context)
:::

---

## Callout

Highlighted information boxes.

::: callout
**Default Callout**
Draws attention to important information without implying status.
:::

::: callout success
**Success Callout**
Indicates positive outcomes or successful operations.
:::

::: callout warning
**Warning Callout**
Highlights cautionary information.
:::

::: callout danger
**Danger Callout**
Alerts to critical issues or errors.
:::

---
## Card

Content cards with borders and shadows.

::: card
### Card Title

Cards provide visual separation and grouping for content blocks. Good for feature highlights or key information.
:::

::: card emphasis
### Emphasized Card

The emphasis modifier increases visual prominence.
:::

---

## Box & Panel

::: box
**Box** - A simple container with border and background. Good for grouping related content.
:::

::: panel
#### Panel Header

Panels include a distinct header section. Good for structured content with titles.
:::

---

## Steps

::: steps
**Define the Problem** - Clearly articulate what needs to be solved

**Research Solutions** - Explore existing approaches and options

**Implement** - Build the chosen solution

**Validate** - Test and verify the results
:::

---

<!-- _class: columns -->

## Metric & Stat

:::: col
### Metric

Large, centered KPI display:

::: metric
**98.5%**
Customer Satisfaction
:::
::::

:::: col
### Stat

Inline value with trend indicator:

::: stat
<span class="value">$4.2M</span>
<span class="trend up">+23%</span>
<span class="label">Revenue</span>
:::

::: stat
<span class="value">1,247</span>
<span class="trend down">-8%</span>
<span class="label">Open Tickets</span>
:::
::::

---

<!-- _class: metrics success -->

## Metrics Dashboard

::: metric
**2.4M**
Active Users
:::

::: metric
**99.9%**
Uptime
:::

::: metric
**< 50ms**
Response Time
:::

::: metric
**4.8★**
App Rating
:::


---

## Badge

Inline labels and tags:

::: badge
NEW
:::

::: badge success
STABLE
:::

::: badge warning
BETA
:::

::: badge danger
DEPRECATED
:::

---

<!-- _class: section warning -->

# 5. Modifiers

Size, emphasis, and position

---

## Size Modifiers

Apply to slides or containers to adjust scale:

| Modifier    | Scale | Example                               | Use Case               |
| ----------- | ----- | ------------------------------------- | ---------------------- |
| `tiny`      | 70%   | <span class="tiny">tiny text</span>   | Fine print, dense data |
| `small`     | 85%   | <span class="tiny">small text</span>  | More content per slide |
| `(default)` | 100%  | normal text                           | Standard presentation  |
| `large`     | 115%  | <span class="large">large text</span> | Key points, visibility |
| `huge`      | 130%  | <span class="huge">huge text</span>   | Maximum impact         |

**Slide example:** `<!-- _class: small -->` or `<!-- _class: lead large -->`
**Container example:** `::: callout small`

---

<!-- _class: small -->

## Size: Small (85%)

This slide uses the `small` modifier, allowing more content while maintaining readability.

- More bullet points fit on the slide
- Tables can show more data
- Good for detailed technical content
- Still maintains comfortable reading

| Column A | Column B | Column C | Column D |
|----------|----------|----------|----------|
| Data 1 | Data 2 | Data 3 | Data 4 |
| Data 5 | Data 6 | Data 7 | Data 8 |

---

<!-- _class: large -->

## Size: Large (115%)

Maximum readability

Key points stand out

Good for emphasis slides

---

## Emphasis Modifiers

| Modifier | Effect |
|----------|--------|
| `muted` | Reduced opacity, de-emphasized |
| `(default)` | Standard appearance |
| `emphasis` | Stronger accent colors |
| `highlight` | Maximum prominence with glow |

::: callout muted
**Muted** - De-emphasized content
:::

::: callout emphasis
**Emphasis** - Highlighted importance
:::

---

## Position Modifiers

For absolute positioning within slides:

| Modifier | Position |
|----------|----------|
| `top`, `bottom`, `left`, `right` | Edge-centered |
| `center` | Slide center |
| `top-left`, `top-right` | Corners |
| `bottom-left`, `bottom-right` | Corners |

**Usage:** `::: caption bottom-right`

**Escape hatch:** For pixel-precise positioning:
`::: caption bottom:40px right:20px`

---

<!-- _class: section energetic -->

# 6. Real-World Combinations

Practical usage examples

---

<!-- _class: lead premium -->

# Executive Summary

## Q4 Results Exceeded Expectations

**Board Presentation** | December 2025

---

<!-- _class: metrics success -->

## Key Performance Indicators

::: metric
**$12.4M**
Revenue
:::

::: metric
**+34%**
YoY Growth
:::

::: metric
**2.1M**
Active Users
:::

::: metric
**92**
NPS Score
:::

---

<!-- _class: split confident -->
## Technical Architecture

:::: col
### Current State

- Monolithic application
- Single database
- Manual deployments
- Limited scalability

::: callout warning
Performance issues at peak load
:::
::::

:::: col
### Proposed State

- Microservices architecture
- Distributed data stores
- CI/CD pipeline
- Auto-scaling

::: callout success
"99.9% uptime target"
:::
::::

---

<!-- _class: process energetic wrap-2 -->

## Implementation Roadmap

1. **Phase 1: Foundation**
   Infrastructure setup, CI/CD pipeline
2. **Phase 2: Migration**
   Service extraction, data migration
3. **Phase 3: Optimization**
   Performance tuning, monitoring
4. **Phase 4: Launch**
   Gradual rollout, feature flags

---

<!-- _class: code small -->

## API Example

::: code-block
#### POST /api/presentations

```json
{
  "title": "Q4 Results",
  "theme": "reference-dark",
  "mood": "success",
  "slides": [
    {
      "layout": "lead",
      "content": { "title": "Q4 Results", "subtitle": "..." }
    },
    {
      "layout": "metrics",
      "mood": "success",
      "content": { "metrics": [...] }
    }
  ]
}
```
:::

---

<!-- _class: comparison -->

## Pricing Comparison

::: col
### Basic

- 10 presentations/month
- Standard themes
- PDF export
- Email support

**$9/month**
:::

::: col
### Professional

- Unlimited presentations
- Custom themes
- All export formats
- Priority support
- API access

**$29/month**
:::

---

<!-- _class: quote calm -->

> The best presentations tell a story. Use moods to guide emotional response, layouts to structure information, and containers to highlight what matters.

<cite>Design System Philosophy</cite>

---

<!-- _class: section confident -->

# 7. For AI Usage

Guidelines for automated generation

---

## AI Generation Guidelines

When generating presentations with this design system:

### Mood Selection
1. **Analyze content sentiment** - Match mood to message
2. **Consider audience** - Premium for executives, confident for corporate
3. **One mood per slide** - Don't combine moods
4. **Default to neutral** - When uncertain

### Layout Selection
1. **Lead** for titles and chapter starts
2. **Columns/Split** for comparisons
3. **Metrics** for KPIs (max 4-6 metrics)
4. **Quote** for impactful statements
5. **Process** for workflows (max 4-5 steps)

---

## AI Generation Rules

### Do's
- Use `small` class for data-heavy slides
- Apply consistent moods within sections
- Use callouts for important notices
- Leverage semantic container variants (success, warning, danger)
- Use `::::` (4 colons) for outer containers when nesting

### Don'ts
- Don't mix multiple moods on one slide
- Don't exceed 4-6 bullet points per column
- Don't forget to increase colons when nesting containers
- Don't use `huge` for content slides (only for impact)
- Don't position-override without clear purpose

---

## Content-to-Layout Mapping

| Content Type | Recommended Layout | Mood Suggestion |
|--------------|-------------------|-----------------|
| Title/Intro | `lead` | Match presentation tone |
| Data/Stats | `metrics` | `confident` or `success` |
| Before/After | `comparison` | `neutral` |
| Steps/Process | `process` | `energetic` |
| Features | `columns` or `thirds` | `confident` |
| Risks/Issues | Any + callout | `warning` or `danger` |
| Quotes | `quote` | `calm` or `premium` |
| Summary | `lead` or section | `calm` |

---

## Example Prompt Structure

```markdown
Generate a Marp presentation using reference-dark theme:

Topic: [Topic]
Audience: [Technical/Executive/Sales]
Tone: [Professional/Energetic/Serious]
Slides: [Number]

Include:
- Lead slide with title
- Agenda slide
- Content slides with appropriate moods
- Summary/thank you slide

Use moods consistently within sections.
Prefer columns/split for comparisons.
Use metrics layout for KPIs.
```

---

<!-- _class: section premium -->

# 8. Theme Creation

How to create new themes

---

## Creating a New Theme

1. **Copy the template** - Start with `reference-dark.css` or `reference-light.css`
2. **Update metadata** - Change `@theme` name and author
3. **Modify primitives** - Adjust Layer 1 variables only
4. **Test contrast** - Verify WCAG compliance
5. **Test all moods** - Ensure each mood is visually distinct

### What to Change (Layer 1 Only)
- Font families
- Color hues and saturations
- Spacing scale (if brand requires)
- Border radii

### What NOT to Change
- Semantic token names (Layer 2)
- Component token structure (Layer 3)
- Class names and selectors

---

## Mood Customization

When defining moods for a new theme:

```css
section.your-mood {
  /* Background gradient using brand colors */
  --bg-gradient: linear-gradient(135deg,
    hsl(YOUR_HUE, 30%, 12%) 0%,
    hsl(YOUR_HUE, 25%, 8%) 100%);

  /* Primary accent - must contrast with bg (4.5:1 min) */
  --accent-1: hsl(YOUR_HUE, 80%, 55%);

  /* Secondary accent - complementary or analogous */
  --accent-2: hsl(YOUR_HUE + 30, 70%, 50%);

  /* Muted accent for subtle elements */
  --accent-muted: hsl(YOUR_HUE, 40%, 35%);

  /* Glow effect color */
  --glow-color: rgba(R, G, B, 0.15);

  /* Typography overrides */
  --heading-accent: var(--accent-1);
  --text-emphasis: var(--accent-1);
  --marker-color: var(--accent-1);
}
```

---

## Hue Relationships

For consistent mood palettes:

| Relationship | Hue Offset | Use Case |
|--------------|------------|----------|
| Monochromatic | ±0° | Single color moods |
| Analogous | ±30° | Harmonious accent-2 |
| Complementary | ±180° | High contrast accent-2 |
| Split-complementary | ±150° | Balanced contrast |

**Recommendation:** Use analogous (+30°) for `accent-2` in most moods.
Reserve complementary for high-impact moods like `energetic`.

---

## Testing Checklist

Before deploying a new theme:

- [ ] All 8 moods render correctly
- [ ] Contrast ratios meet WCAG AA minimum
- [ ] All slide layouts work as expected
- [ ] All containers display properly
- [ ] Size modifiers scale correctly
- [ ] Code highlighting is readable
- [ ] Tables maintain structure
- [ ] Export to PDF preserves colors
- [ ] Export to PPTX is functional

---

<!-- _class: section energetic -->

# 9. Advanced Container Syntax

Extended capabilities via genericContainerPlugin

---

## Container Syntax Overview

The Obsidian Marp Plugin extends standard markdown-it containers with powerful features:

```markdown
::: [tag.]class[#id][ additional-classes][ style-declarations]
Content here
:::
```

| Part | Description | Example |
|------|-------------|---------|
| `tag.` | HTML tag (optional, default: `div`) | `span.`, `aside.` |
| `class` | Primary CSS class (required) | `caption`, `callout` |
| `#id` | HTML ID (optional) | `#my-element` |
| `additional-classes` | Space-separated classes | `small transparent` |
| `style-declarations` | Inline CSS styles | `width:50% top:20px` |

---

## Basic Container Examples

### Simple class
```markdown
::: callout
This creates a div with class="callout"
:::
```

### Multiple classes
```markdown
::: callout warning small
Multiple classes: class="callout warning small"
:::
```

### Custom HTML tag
```markdown
::: aside.note
Creates: <aside class="note">...</aside>
:::
```

### With ID
```markdown
::: card#featured-card
Creates: <div class="card" id="featured-card">...</div>
:::
```

---

## Inline Style Declarations

Two formats - **do not mix them**:

### 1. Space-separated (preferred)
```markdown
::: caption width:50% top:20px background:rgba(10,0,40,0.5)
Creates: style="width: 50%; top: 20px; background: rgba(10,0,40,0.5)"
:::
```
Works for most values including `rgba()` - no spaces after commas!

### 2. CSS-literal with semicolons (escape hatch)
```markdown
::: box width:50%; background:url(https://example.com/img.jpg);
Use ONLY when values contain colons (like URLs)
:::
```

**Critical:** Semicolon is a **mode switch** - use everywhere or nowhere:
- `width:50% background:rgba(0,0,0,0.5)` - OK
- `width:50%; background:rgba(0,0,0,0.5);` - OK
- `width:50% background:rgba(0,0,0,0.5);` - BROKEN (mixed)

---

<!-- _class: columns -->

## Positioned Captions

:::: col
### Position Classes

Combine `.caption` with position modifiers:

- `top`, `bottom`, `left`, `right`
- `top-left`, `top-right`
- `bottom-left`, `bottom-right`
- `center`

These use CSS `position: absolute`.
::::

:::: col
### Using Inline Styles

For precise positioning:

```markdown
::: caption top:90px left:240px width:60%
Pixel-precise placement
:::
```

Override default positions when needed.
::::

---
<!-- _paginate: false -->
<!-- _header: "" -->
<!-- _footer: "" -->

![bg opacity:0.3](https://picsum.photos/1280/720)

::: center
## Caption Positioning Demo
:::

::: caption top width:80%
**Top Caption** - Centered at top, spanning most of the slide width
:::

::: caption bottom-left width:35%
**Bottom-Left Caption**
Position class moves it to corner
:::

::: caption bottom-right width:35%
**Bottom-Right Caption**
Great for image annotations
:::

---
<!-- _paginate: false -->
<!-- _header: "" -->
<!-- _footer: "" -->

![bg opacity:0.3](https://picsum.photos/1280/720)

::: center
## Custom Position with Styles
:::

::: caption top:100px left:50px width:40% background:rgba(10,0,40,0.7) backdrop-filter:blur(8px)
**Custom Positioned Caption**

Using inline styles for:
- Exact pixel positioning
- Translucent background
- Backdrop blur effect
  :::

::: caption bottom:80px right:50px width:35% background:rgba(0,100,50,0.6)
**Another Custom Caption**
Green-tinted background
:::

---

## Nesting Containers

When nesting, **add one colon per level**:

```markdown
:::: columns                    <!-- Outer: 4 colons -->

::: col                         <!-- Inner: 3 colons -->
### Left Column
Content here
:::

::: col
### Right Column
::: callout warning             <!-- Nested in col: still 3 (sibling) -->
Warning inside column
:::
:::

::::                            <!-- Close outer: 4 colons -->
```

**Matching rule:** Opening and closing colons must match count.

---

<!-- _class: columns -->

## Nesting Example: Columns with Callouts

:::: col
### Feature A

Main content for Feature A goes here.

::: callout success
**Pro Tip**
This callout is nested inside a column.
:::

More text after the callout.
::::

:::: col
### Feature B

Main content for Feature B.

::: callout danger
**Warning**
Nested callouts work seamlessly.
:::

Final thoughts here.
::::

---

## Deep Nesting (3 Levels)

```markdown
::::: card                      <!-- Level 1: 5 colons -->
#### Card Title

:::: columns                    <!-- Level 2: 4 colons -->
::: col                         <!-- Level 3: 3 colons -->
Left content
:::
::: col
Right content
:::
::::

:::::
```

**Rarely needed** - prefer simpler structures when possible.

---

<!-- _class: small -->

## Container + Style Combinations

| Use Case | Syntax |
|----------|--------|
| Translucent overlay | `::: caption background:rgba(0,0,0,0.5) backdrop-filter:blur(8px)` |
| Fixed-width box | `::: box width:300px` |
| Positioned callout | `::: callout warning bottom-right width:40%` |
| Custom tag + class | `::: aside.sidebar#nav` |
| Full styling | `::: caption top:20px left:20px width:37% background:rgba(10,0,40,0.5)` |

**Pattern for image slides:**
```markdown
![bg](image.jpg)
::: caption bottom-left width:40% background:rgba(10,0,40,0.7)
> Quote or description overlaying the image
:::
```

---

## Recreating Legacy Caption Classes

The legacy `space-legacy` theme had preset caption classes. Replicate them:

| Legacy Class | New Syntax |
|--------------|------------|
| `.caption-top` | `::: caption top width:90%` |
| `.caption-bottom` | `::: caption bottom width:90%` |
| `.caption-left` | `::: caption top-left width:37%` |
| `.caption-right` | `::: caption top-right width:37%` |
| `.caption-bottom-left` | `::: caption bottom-left width:37%` |
| `.caption-bottom-right` | `::: caption bottom-right width:37%` |

Add `background:rgba(10,0,40,0.5)` for translucency.

---

<!-- _class: code small -->

## Complete Example: Image Slide with Captions

```markdown
---
![bg](path/to/dramatic-image.jpg)

::: caption top width:90% background:rgba(10,0,40,0.5)
> "The mission begins. All systems nominal."
:::

::: caption bottom-right width:35% background:rgba(10,0,40,0.7)
**Status:** Ready for launch
**Crew:** 5 members
:::
```

This creates a full-bleed background image with two styled caption overlays.

---

<!-- _class: section confident -->

# 10. AI Generation: Container Patterns

Best practices for automated presentation generation

---

## AI: Caption Selection Guide

When generating slides with background images:

| Image Type | Recommended Caption |
|------------|---------------------|
| Wide landscape | `caption bottom width:80%` |
| Portrait/vertical | `caption bottom-left width:40%` or `bottom-right` |
| Busy/detailed | Add `background:rgba(10,0,40,0.7) backdrop-filter:blur(8px)` |
| Simple/minimal | Lighter: `background:rgba(0,0,0,0.3)` |
| Quote overlay | `caption center width:70%` with large text |

**Always ensure text contrast** - darker backgrounds for light images.

---

## AI: Multi-Column Patterns

### Two Columns (Equal)
```markdown
<!-- _class: columns -->
::: col
Left content
:::
::: col
Right content
:::
```

### Two Columns with Nested Components
```markdown
<!-- _class: split -->
:::: col
### Before
::: callout danger
Problem description
:::
::::
:::: col
### After
::: callout success
Solution description
:::
::::
```

---

## AI: When to Use Inline Styles

| Scenario | Use Inline Styles? |
|----------|-------------------|
| Standard caption positions | No - use position classes |
| Precise pixel placement | Yes - `top:90px left:240px` |
| Translucent backgrounds | Yes - `background:rgba(...)` |
| Custom widths | Yes - `width:42%` |
| Standard component styling | No - rely on CSS classes |
| One-off visual effects | Yes |

**Principle:** Use CSS classes for reusable patterns, inline styles for exceptions.

---

## AI: Container Syntax Quick Reference

```markdown
# Basic
::: class
::: class modifier
::: class modifier1 modifier2

# With ID
::: class#element-id

# Custom tag
::: span.highlight
::: aside.note#sidebar

# With styles (space-separated)
::: class width:50% top:20px

# With styles (CSS-literal - only for URLs with colons)
::: class background:url(https://example.com/img.jpg);

# Nested (increase colons)
:::: outer
::: inner
:::
::::
```

---

## AI: Common Mistakes to Avoid

### Wrong: Style without class
```markdown
::: width:50%          <!-- Missing class name -->
```

### Wrong: Mismatched colon counts
```markdown
:::: container
Content
:::                    <!-- Should be :::: -->
```

### Wrong: Mixing semicolon modes
```markdown
::: caption width:50% background:rgba(0,0,0,0.5);   <!-- Mixed! -->
```

### Correct versions:
```markdown
::: caption width:50% background:rgba(0,0,0,0.5)    <!-- All without ; -->
::: caption width:50%; background:rgba(0,0,0,0.5);  <!-- All with ; -->
```

### Wrong: URL without semicolons (contains `:`)
```markdown
::: box background:url(https://example.com/img.jpg)  <!-- Needs ; mode -->
```

### Correct:
```markdown
::: box background:url(https://example.com/img.jpg);  <!-- ; everywhere -->
```

---

<!-- _class: lead calm -->
<!-- _paginate: false -->
<!-- _header: "" -->
<!-- _footer: "" -->

# Thank You

## Marp Design System Reference

Use this document as a guide for creating consistent,
professional presentations.

**Questions?** Check the theme CSS files for implementation details.
