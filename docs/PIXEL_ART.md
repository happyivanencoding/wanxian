# 像素美术资产

用户于2026-10-21选择第4套「像素问道」概念，并要求全部界面统一实现。本页记录用于产品的原创栅格源资产；它们不是构建缓存或测试截图。

这些图片由内置 image_gen 根据已选概念生成，核心UI的文字、数值、布局及按钮均由真实组件绘制。素材在本项目本地提供，不依赖外部图片地址。未将整张概念UI作为可交互界面。

- `public/art/pixel-scene.png`：宽幅山门场景。
- `public/art/pixel-portraits.png`：四列两行人物头像图集。
- `public/art/pixel-items.png`：四列四行透明物品图集。

## 生成提示词

### scene

Create a production game-art asset based on the pixel-art visual language in the reference mobile UI. Output ONLY a wide panoramic environment illustration, approximately 2.5:1 width to height, no UI whatsoever, NO text, NO labels, NO typography, NO frames. Beautiful sophisticated Chinese xianxia pixel-art mountain sanctuary at blue hour: layered ink navy mountains, jade waterfall, a compact tiled-roof shrine and lantern-lit stone terrace in the left foreground, distant cliff monasteries at right, small moon, very fine deliberate visible pixel clusters, gold lanterns against cool blues and turquoise. Leave the middle terrace empty so game UI may overlay later; no large human character. Preserve the reference's polished retro RPG palette and handcrafted pixel style. Useful detailed foreground, minimal empty sky. This is a local website/game background asset, not a screenshot or poster. Entire image filled by art, opaque background.

### portraits

Create a production character portrait sprite atlas in the exact refined xianxia pixel-art style of the reference UI. Output ONLY an atlas: STRICT 4 columns by 2 rows of EIGHT equally sized SQUARE tiles, edge-to-edge grid without ANY gutters or borders, overall aspect ratio2:1. Each tile contains ONE centered Chinese cultivation character bust, face and shoulders, with generous interior padding, on identical solid dark navy #102437 backgrounds. NO text, labels, numerals, UI, item icons or frames. TOP row, left to right: young male scholar with black tied hair and ivory/blue robes; calm middle-aged male healer with green scarf; rugged young male mountain traveler with brown cloak; reserved young male swordsman with pale hair and dark teal robes. BOTTOM row, left to right: young female sword cultivator, black hair tied high and blue/white robes matching reference; thoughtful young female scholar with dark bun and jade robe; confident female traveler with short tied hair and warm cloak; elderly female healer with silver hair and muted gold robe. Faces attractive and distinct but original, no franchise characters. Every portrait aligned to same face scale, front three-quarter view, shoulder and hair contained inside its exact grid tile. Crisp intentional pixel clusters, limited ink-blue jade gold palette, clean readable faces at 64px display size. Do not draw a UI screenshot: ONLY the strict evenly spaced portrait atlas.

### items

Create a transparent production game icon sprite atlas inspired by the Chinese xianxia pixel art in the reference. Output ONLY a STRICT 4 by 4 grid of SIXTEEN equally sized SQUARE cells, overall square aspect. Each icon perfectly centered in its cell with generous transparent padding, no icon touches or crosses its own cell boundary. All cells identical dimensions, zero gutters between cells, no frames or visible grid. Fully transparent background, no shadow rectangles, no background scene. NO text, letters, numerals or labels. Row1 left-to-right: elegant steel-blue sword; folded blue-and-white cultivator robe; luminous jade amulet; green double-gourd flask. Row2: bundle of green medicinal herbs; small red/gold pill bottle; closed dark-blue cultivation manual; blue crystalline spirit stone. Row3: tiny mountain sanctuary cottage; golden-roofed sect gateway; bronze alchemy furnace; rolled parchment scroll. Row4: folded travel map; sealed cream letter; tied coin purse; cyan mystical formation ring. Precisely match a handcrafted high-quality 16/32-bit RPG style: intentional crisp pixel clusters, strong recognizable silhouettes, restrained tiny highlights, navy outlines with jewel colors. Designed to remain legible at 32–48px onscreen. Every cell contains exactly one requested icon, consistent visual scale and baseline. Do not draw UI, captions, number counters, selection boxes, or ornaments outside the icons.
