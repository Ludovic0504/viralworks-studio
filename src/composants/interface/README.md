# Composants Réutilisables

Collection de composants réutilisables pour accélérer le développement.

## Import

```jsx
import { Button, Input, Textarea, Card, Badge, Select, Loading, Message, Tabs, StatCard } from "@/composants/interface";
```

## Composants

### Button

Bouton réutilisable avec variantes et états.

```jsx
<Button variant="primary" size="md" loading={false}>
  Cliquer
</Button>

<Button variant="secondary" icon={Sparkles}>
  Avec icône
</Button>
```

**Props:**
- `variant`: "primary" | "secondary" | "danger" | "ghost"
- `size`: "sm" | "md" | "lg"
- `loading`: boolean
- `disabled`: boolean
- `icon`: Composant d'icône Lucide

### Input

Champ de saisie avec label et gestion d'erreur.

```jsx
<Input
  label="Email"
  icon={Mail}
  type="email"
  placeholder="ton@email.com"
  error={errors.email}
/>
```

### Textarea

Zone de texte avec label et gestion d'erreur.

```jsx
<Textarea
  label="Description"
  icon={FileText}
  rows={5}
  placeholder="Décris ton idée..."
  error={errors.description}
/>
```

### Card

Carte avec effet glass.

```jsx
<Card hover>
  <h3>Titre</h3>
  <p>Contenu</p>
</Card>
```

**Props:**
- `hover`: boolean - Effet hover
- `padding`: boolean - Padding par défaut

### Badge

Badge avec variantes de couleur.

```jsx
<Badge variant="success">Actif</Badge>
<Badge variant="warning">En attente</Badge>
```

**Variants:** "default" | "success" | "warning" | "danger" | "info" | "violet"

### Select

Liste déroulante avec label.

```jsx
<Select
  label="Format"
  options={[
    { value: "16:9", label: "16:9" },
    { value: "1:1", label: "1:1" }
  ]}
/>
```

### Loading

Composant de chargement.

```jsx
<Loading size="md" text="Chargement..." />
<Loading fullScreen text="Chargement en cours..." />
```

**Props:**
- `size`: "sm" | "md" | "lg"
- `text`: string
- `fullScreen`: boolean

### Message

Message d'alerte avec types.

```jsx
<Message type="success" onClose={() => {}}>
  Opération réussie !
</Message>

<Message type="error">
  Une erreur est survenue
</Message>
```

**Types:** "success" | "error" | "warning" | "info"

### Tabs

Composant d'onglets.

```jsx
<Tabs
  tabs={[
    { value: "tab1", label: "Onglet 1", icon: FileText },
    { value: "tab2", label: "Onglet 2", icon: Image }
  ]}
  activeTab={currentTab}
  onChange={setCurrentTab}
/>
```

### StatCard

Carte de statistique.

```jsx
<StatCard
  icon={FileText}
  value="42"
  label="Textes créés"
  color="cyan"
  trend="+12%"
/>
```

**Colors:** "emerald" | "cyan" | "violet" | "yellow"

