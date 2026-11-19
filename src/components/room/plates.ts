import onLarge from '@/assets/plates/room-lamp-on-2560.webp.asset.json';
import offLarge from '@/assets/plates/room-lamp-off-2560.webp.asset.json';
import lightLarge from '@/assets/plates/room-screen-light-2560.webp.asset.json';
import onSmall from '@/assets/plates/room-lamp-on-1280.webp.asset.json';
import offSmall from '@/assets/plates/room-lamp-off-1280.webp.asset.json';
import lightSmall from '@/assets/plates/room-screen-light-1280.webp.asset.json';
import mask from '@/assets/plates/glass-mask.png.asset.json';
import reflection from '@/assets/plates/glass-reflection-lamp-on.webp.asset.json';

export const plates = { on: [onSmall.url, onLarge.url], off: [offSmall.url, offLarge.url], light: [lightSmall.url, lightLarge.url], mask: mask.url, reflection: reflection.url };
export const plateSet = (p: string[]) => `${p[0]} 1280w, ${p[1]} 2560w`;