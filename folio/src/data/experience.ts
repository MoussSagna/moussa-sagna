/** Un champ à `null` (ou une liste vide) signifie « information à fournir ». */
export interface ExperienceEntry {
  period: string;
  company: string | null;
  role: string | null;
  missions: string | null;
  skills: string[];
}

/** Parcours, du plus récent au plus ancien. */
export const EXPERIENCE: ExperienceEntry[] = [
  {
    period: '2023 – 2025',
    company: 'SACEM',
    role: 'UI/UX Designer',
    missions: null,
    skills: ['UI Design', 'UX Design'],
  },
  {
    period: '2020 – 2021',
    company: 'SONOFSNEAKERS',
    role: 'Webdesigner',
    missions: null,
    skills: ['Webdesign'],
  },
  {
    period: '2019 – 2020',
    company: 'Association Team Trail Ouzbek',
    role: 'Webdesigner',
    missions: null,
    skills: ['Webdesign'],
  },
  {
    period: '2017 – 2018',
    company: null,
    role: null,
    missions: null,
    skills: [],
  },
];
