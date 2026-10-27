/**
 * 出生信息表单状态 —— 从 Sample/components/BirthForm.tsx 逐字抽出，
 * 供 share.ts（formToBirthInfo）与 Svelte 版 BirthForm 组件共用。
 */
export interface BirthFormState {
  name: string;
  year: string;
  month: string;
  day: string;
  clockHour: string;
  clockMinute: string;
  unknownTime: boolean;
  province: string;
  city: string;
  longitude: number;
  gender: 'male' | 'female';
}
