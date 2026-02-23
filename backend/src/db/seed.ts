import bcrypt from 'bcryptjs';
import { db } from './index.js';
import { users, waterBodies, referenceSections, permitOrganizations } from './schema.js';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@spearfishing.by';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function seed() {
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await db.insert(users).values({
    email: ADMIN_EMAIL,
    passwordHash: hash,
    role: 'admin',
    allowedIp: null,
  }).onConflictDoNothing();

  await db.insert(referenceSections).values([
    { slug: 'equipment', title: 'Экипировка', titleRu: 'Экипировка', orderIndex: 1, content: `## Что нужно для подводной охоты

- **Гидрокостюм** — неопреновый, под погоду и температуру воды.
- **Маска и трубка** — маска с обзором, трубка с клапаном.
- **Ласты** — длинные для плавания, удобные для ног.
- **Подводное ружьё** — пневматическое или арбалет, по законодательству.
- **Грузовой пояс** — для компенсации плавучести.
- **Перчатки и носки** — защита от холода и травм.
- **Нож** — для безопасности и разделки улова.
- **Кукан** — для крепления пойманной рыбы.

Перед выездом проверьте срок действия разрешения и правила водоёма.` },
    { slug: 'rules', title: 'Правила', titleRu: 'Правила', orderIndex: 2, content: `## Правила подводной охоты в Беларуси

- Охота разрешена только в водоёмах, включённых в перечень.
- Необходимо иметь разрешение (путёвку) от организации, ведущей рыбное хозяйство.
- Соблюдайте сроки и нормы вылова, установленные для каждого водоёма.
- Запрещено использовать акваланги и другие дыхательные аппараты.
- Запрещена охота в местах массового отдыха и в заповедных зонах.

Актуальные правила уточняйте в БООР и местных организациях.` },
  ]).onConflictDoNothing();

  await db.insert(permitOrganizations).values([
    { name: 'БООР — Брестская область', nameRu: 'БООР — Брестская область', region: 'Брестская', description: 'Выдача разрешений на подводную охоту', url: 'https://rgooboor.by/fishing/15?type=8', orderIndex: 1 },
    { name: 'БООР — Гомельская область', nameRu: 'БООР — Гомельская область', region: 'Гомельская', description: 'Выдача разрешений на подводную охоту', url: 'https://rgooboor.by/fishing/26?type=8', orderIndex: 2 },
  ]).onConflictDoNothing();

  // Примеры водоёмов (координаты условные — можно заменить реальными)
  await db.insert(waterBodies).values([
    { name: 'Озеро Белое (Брестская обл.)', nameRu: 'Озеро Белое (Брестская обл.)', region: 'Брестская', lat: '52.0875', lng: '25.8019', description: 'Разрешена подводная охота по путёвкам БООР.', permitInfo: 'Путёвка БООР', orderIndex: 1 },
    { name: 'Водохранилище (пример)', nameRu: 'Водохранилище (пример)', region: 'Гомельская', lat: '52.4345', lng: '30.9754', description: 'Уточняйте перечень в БООР.', permitInfo: 'Путёвка БООР', orderIndex: 2 },
  ]).onConflictDoNothing();

  console.log('Seed done. Admin:', ADMIN_EMAIL);
}

seed().catch(console.error);
