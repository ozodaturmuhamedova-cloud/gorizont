/** Все строки интерфейса (CLAUDE.md §9). */
import type { ApartmentStatus, RoomCount, RoomType } from '../domain/types';

const roomTypes: Record<RoomType, string> = {
  living: 'Гостиная',
  bedroom: 'Спальня',
  kitchen: 'Кухня',
  bath: 'Санузел',
  hall: 'Прихожая',
  balcony: 'Балкон',
};

const status: Record<ApartmentStatus, string> = {
  free: 'Свободна',
  reserved: 'Бронь',
  sold: 'Продана',
};

export const strings = {
  brand: {
    name: 'ЖК Горизонт',
    tagline: 'Квартиры с отделкой и мебелью · Секция 1 · 9 этажей',
  },
  nav: {
    plan: 'Поэтажный план',
    main: 'Основная навигация',
  },
  plan: {
    title: 'Поэтажный план',
    lead: 'Выберите этаж и квартиру. Свободные квартиры можно открыть в 3D и обставить мебелью.',
    stub: 'Здесь появится интерактивный план этажа с фильтрами (фаза 2).',
    demoTitle: 'Демо-квартира',
    open3d: 'Смотреть в 3D',
    perM2: 'за м²',
  },
  apartment: {
    number: (n: number) => `Кв. ${n}`,
    floor: (n: number) => `${n} этаж`,
    rooms: (n: RoomCount) => (n === 0 ? 'Студия' : `${n}-комн.`),
  },
  tour: {
    title: (number: number) => `Квартира ${number} в 3D`,
    stub: 'Здесь появится 3D-тур: обзор, прогулка с учётом роста, расстановка мебели и смета (фазы 4–5).',
    back: 'Назад к плану',
    loading: 'Загружаем 3D-сцену…',
  },
  notFound: {
    code: '404',
    title: 'Такой страницы нет',
    text: 'Возможно, ссылка устарела или квартира уже снята с продажи.',
    home: 'Вернуться к плану',
  },
  roomTypes,
  status,
} as const;

/** Демо-квартира для заглушек, пока нет интерактивного плана (фаза 2): кв. 51, 9 этаж, 2-комн. */
export const DEMO_APARTMENT_ID = 's1-f9-a3';
