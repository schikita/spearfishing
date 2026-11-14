export const DISCLAIMER =
  'Данные носят справочный характер и не являются разрешением на подводную охоту. Сверяйте запреты и перечни с правилами рыболовства и решениями облисполкомов. Внешняя карта разрешённых водоёмов неофициальная и может содержать ошибки.';

export type RiskLevel = 'low' | 'medium' | 'high' | 'missing';
export type RoadStatus = 'ok' | 'risky' | 'only_4x4' | 'likely_closed' | 'unknown';

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function scoreToLevel(score: number): RiskLevel {
  if (score <= 25) return 'low';
  if (score <= 55) return 'medium';
  return 'high';
}

export function turbidityFactor(bodyType: string | null | undefined): number {
  switch (bodyType) {
    case 'river':
      return 1.3;
    case 'reservoir':
      return 1.0;
    case 'lake':
      return 0.7;
    case 'quarry':
      return 0.5;
    case 'pond':
      return 0.9;
    default:
      return 1.0;
  }
}

export function bloomFactor(bodyType: string | null | undefined): number {
  switch (bodyType) {
    case 'lake':
      return 1.2;
    case 'reservoir':
      return 1.0;
    case 'quarry':
      return 0.6;
    case 'river':
      return 0.4;
    case 'pond':
      return 0.9;
    default:
      return 1.0;
  }
}

/** Больше 4 м — низкая мутность, 2–4 м — средняя, меньше 2 м — высокая. */
export function visibilityToScore(visibilityM: number): number {
  if (visibilityM > 4) return 10;
  if (visibilityM >= 2) return 40;
  return 80;
}

export function turbidityRisk(input: {
  precip3d: number | null;
  precip7d: number | null;
  bodyType: string | null | undefined;
  report?: { visibilityM: number; ageDays: number } | null;
}): { score: number | null; level: RiskLevel } {
  const hasWeather = input.precip3d != null && input.precip7d != null;
  const weatherScore = hasWeather
    ? Math.min(100, input.precip3d! * 4 * turbidityFactor(input.bodyType) + input.precip7d! * 1.5 * turbidityFactor(input.bodyType))
    : null;
  const report = input.report;
  if (!report || report.ageDays > 14) {
    if (weatherScore == null) return { score: null, level: 'missing' };
    return { score: weatherScore, level: scoreToLevel(weatherScore) };
  }
  const ugc = visibilityToScore(report.visibilityM);
  if (weatherScore == null) return { score: ugc, level: scoreToLevel(ugc) };
  const weight = report.ageDays <= 5 ? 0.7 : 0.4;
  const score = weight * ugc + (1 - weight) * weatherScore;
  return { score, level: scoreToLevel(score) };
}

export function bloomRisk(input: {
  tempMean7d: number | null;
  sunshineHours7d: number | null;
  precip7d: number | null;
  bodyType: string | null | undefined;
  month: number;
  ugcBloom?: boolean;
}): { score: number | null; level: RiskLevel } {
  const ready = input.tempMean7d != null && input.sunshineHours7d != null && input.precip7d != null;
  if (!ready) {
    if (input.ugcBloom) return { score: 80, level: 'high' };
    return { score: null, level: 'missing' };
  }
  let score =
    ((input.tempMean7d! - 14) * 6 + input.sunshineHours7d! * 0.8 - input.precip7d! * 2) * bloomFactor(input.bodyType);
  score = clamp(score, 0, 100);
  const inSeason = input.month >= 5 && input.month <= 9;
  if (!inSeason && !input.ugcBloom) score = Math.min(score, 40);
  if (input.ugcBloom) score = Math.max(score, 70);
  return { score, level: scoreToLevel(score) };
}

export function roadStatus(
  roadClass: string | null | undefined,
  precip3d: number | null,
  precip7d: number | null
): RoadStatus {
  const road = roadClass || 'unknown';
  if (road === 'unknown') return 'unknown';
  if (precip3d == null || precip7d == null) return 'unknown';
  if (road === 'paved') return precip3d > 40 ? 'risky' : 'ok';
  if (road === 'gravel') return precip3d > 20 ? 'risky' : 'ok';
  if (road === 'track') {
    if (precip3d > 30 || precip7d > 60) return 'likely_closed';
    if (precip3d > 10) return 'only_4x4';
    return 'ok';
  }
  if (road === 'field') {
    if (precip3d > 20 || precip7d > 40) return 'likely_closed';
    if (precip3d > 5) return 'only_4x4';
    return 'risky';
  }
  return 'unknown';
}

export function isVisibilityOutlier(visibilityM: number, previousNewestFirst: number[]): boolean {
  if (previousNewestFirst.length < 5) return false;
  const sample = [...previousNewestFirst.slice(0, 5)].sort((a, b) => a - b);
  const median = sample[2];
  return Math.abs(visibilityM - median) > 2;
}

export function levelLabel(level: RiskLevel, kind: 'turbidity' | 'bloom'): string {
  if (level === 'missing') return 'нет данных';
  if (level === 'low') return kind === 'turbidity' ? 'мутность низкая' : 'цветение маловероятно';
  if (level === 'medium') return kind === 'turbidity' ? 'мутность средняя' : 'цветение возможно';
  return kind === 'turbidity' ? 'мутность высокая' : 'риск цветения высокий';
}

export function roadLabel(status: RoadStatus): string {
  switch (status) {
    case 'ok':
      return 'проезд ок';
    case 'risky':
      return 'проезд рискован';
    case 'only_4x4':
      return 'только внедорожник';
    case 'likely_closed':
      return 'скорее закрыто';
    default:
      return 'нет данных о дороге';
  }
}

export const CHECKLIST = [
  { id: 'id_doc', text: 'Возьмите документ, удостоверяющий личность.' },
  { id: 'permit', text: 'Проверьте путёвку или членские документы организации, которая выдаёт разрешения в этой области.' },
  { id: 'rules', text: 'Сверьте водоём с правилами рыболовства и решением облисполкома. Сайт не заменяет эти документы.' },
  { id: 'pit', text: 'Не ведите охоту в зимовальных ямах, даже если остальной водоём есть в перечне.' },
];

export function verificationLabel(status: string): string {
  switch (status) {
    case 'matched':
      return 'совпадает с неофициальной картой';
    case 'not_found_on_map':
      return 'на неофициальной карте не найден';
    case 'not_in_official_list':
      return 'нет в перечне облисполкома';
    case 'needs_review':
    case 'name_conflict':
      return 'требует уточнения';
    default:
      return 'не сверено';
  }
}
