# FrontiRide — Charte graphique

Version 1, arrêtée le 18 août 2026. Le logo retenu est la piste **C — le F directionnel**.

## 1. Le symbole

Un monogramme F dont le bras supérieur se prolonge en flèche : le nom et le mouvement dans un seul signe. Il a été retenu pour sa tenue en petit — il reste lisible à 16 px, là où les pistes concurrentes (barrière de douane, bouclier) se brouillaient.

Tracé maître : [`brand/frontiride-mark.svg`](../brand/frontiride-mark.svg). **Tous les assets se dérivent de ce fichier** — ne jamais redessiner un PNG à la main.

### Règles d'emploi

- Deux couleurs maximum : le vert de marque et le blanc. Ni dégradé, ni ombre, ni contour.
- Sur fond clair : la tuile verte pleine avec le F en blanc.
- **Sur fond sombre : le symbole s'emploie seul, en blanc, sans tuile.** Une tuile vert sombre perd sa définition sur un fond sombre.
- Zone de respiration minimale autour du symbole : la largeur de la hampe du F.

### Lockups

| Fichier | Emploi |
|---|---|
| [`brand/frontiride-lockup-light.svg`](../brand/frontiride-lockup-light.svg) | Fonds clairs — documents, factures, back-office |
| [`brand/frontiride-lockup-dark.svg`](../brand/frontiride-lockup-dark.svg) | Fonds sombres — version inversée |

Le wordmark est **vectorisé** (Archivo 700, sous-ensemble latin) : les lockups ne dépendent d'aucune police installée sur la machine qui les ouvre.

## 2. Couleurs

### Marque

| Nom | Hex | Emploi |
|---|---|---|
| Vert Frontière | `#0B6E52` | Couleur de marque. Boutons principaux, liens, états actifs |
| Vert éclairci | `#35A481` | Même rôle, en thème sombre — le vert de marque y manquerait de contraste |
| Vert Profond | `#083F30` | Fonds pleins, splash screen, barre de statut |
| Ambre Harmattan | `#E0891A` | Accent secondaire : FrontiPoints, badges, palier VIP |

Le vert est volontairement sombre et désaturé : il tient sur fond clair comme sur fond sombre, et ne se confond pas avec le vert-menthe de Bolt.

### Neutres et sémantiques

Les valeurs exactes, thème clair et thème sombre, sont dans [`apps/mobile/src/theme/tokens.ts`](../apps/mobile/src/theme/tokens.ts) — c'est la source de vérité, ce tableau en est le reflet.

| Jeton | Clair | Sombre |
|---|---|---|
| `ground` | `#F2F5F3` | `#0B100E` |
| `surface` | `#FFFFFF` | `#141B18` |
| `surfaceMuted` | `#E9EEEB` | `#1C2521` |
| `text` | `#0F1613` | `#E8EEEB` |
| `textMuted` | `#5A6C66` | `#97A8A2` |
| `border` | `#D8E0DC` | `#26302C` |
| `success` | `#15803D` | `#4ADE80` |
| `warning` | `#B45309` | `#FBBF24` |
| `danger` | `#B91C1C` | `#F87171` |
| `info` | `#0E7490` | `#38BDF8` |

Le noir n'est jamais pur : `#0F1613` est légèrement vert, pour s'accorder au reste de la palette.

## 3. Typographie

| Rôle | Face | Emploi |
|---|---|---|
| Titrage, wordmark | **Archivo** 600/700 | Titres d'écran, montants, libellés de boutons |
| Texte courant | **Pile système** (San Francisco / Roboto) | Paragraphes, descriptions, messages |
| Chiffres alignés | Archivo + `tabular-nums` | Montants en FCFA, références de course, codes OTP |

Archivo est embarquée en sous-ensemble latin (21 Ko par graisse) et chargée par `useAppFonts`. Le texte courant reste sur la pile système : zéro coût de chargement et rendu natif correct en français comme en anglais.

Archivo est distribuée sous **SIL Open Font License 1.1** ([`apps/mobile/assets/fonts/OFL.txt`](../apps/mobile/assets/fonts/OFL.txt)). Elle peut être embarquée et redistribuée librement, y compris dans une app commerciale, à condition de conserver ce fichier de licence.

Les styles nommés (`title`, `heading`, `subheading`, `body`, `label`, `caption`, `amount`) sont définis dans `tokens.ts`. **Ne pas écrire de `fontSize` arbitraire dans un écran** — ajouter un style nommé si aucun ne convient.

## 4. Formes et espacements

- Espacements sur une échelle de 4 : `space[1]` = 4 … `space[12]` = 48.
- Rayons : `sm` 8 (petits contrôles), `md` 12 (champs, boutons), `lg` 18 (cartes), `pill` (puces de choix).
- Hauteur minimale d'une cible tactile : 44 px.

## 5. Assets applicatifs

Tous générés depuis le tracé maître, dans `apps/mobile/assets/` :

| Fichier | Format | Contrainte respectée |
|---|---|---|
| `icon.png` | 1024², **RGB sans alpha** | L'App Store refuse toute couche alpha |
| `android-icon-foreground.png` | 1024², transparent | Motif dans les 66 % centraux (masque Android) |
| `android-icon-background.png` | 1024², aplat vert | |
| `android-icon-monochrome.png` | 1024², blanc sur transparent | Icône thémée, exigée depuis Android 13 |
| `splash-icon.png` | 1024², transparent | Posé sur le Vert Profond |
| `notification-icon.png` | 96², blanc sur transparent | Android aplatit toute autre couleur |
| `favicon.png` | 48² | Export web Expo |

> **Icône, splash et adaptive icon sont compilés dans les ressources natives.** Un rechargement Metro ne les met pas à jour : il faut un nouveau build (`eas build` ou `expo run:android` / `expo run:ios`). Le favicon web, lui, est agressivement mis en cache par le navigateur.

## 6. Régénérer les assets

Le script de génération vit dans l'historique de cette branche. Pour reproduire :

1. Modifier `brand/frontiride-mark.svg`.
2. Réexporter chaque variante avec `cairosvg` aux tailles du tableau ci-dessus.
3. Aplatir la couche alpha de `icon.png` sur le vert de marque.
4. Vérifier visuellement chaque PNG — en particulier le monochrome, qui ressort vide si l'export a gardé le motif en couleur au lieu de blanc sur transparent.
