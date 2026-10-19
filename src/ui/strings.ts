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
    canvasLabel: (floor: number) => `План ${floor} этажа`,
    hint: 'Колесо мыши — масштаб, перетаскивание — сдвиг. Проданные квартиры недоступны.',
    fit: 'Весь этаж',
    zoomIn: 'Приблизить',
    zoomOut: 'Отдалить',
    corridor: 'Коридор',
    stairs: 'Лестница',
    lift: 'Лифт',
    minimap: 'Мини-карта: нажмите, чтобы перейти к месту',
    open3d: 'Смотреть в 3D',
    perM2: 'за м²',
  },
  floors: {
    title: 'Этажи',
    label: 'Шахматка квартир по этажам',
    floor: (n: number) => `${n}`,
    floorButton: (n: number, free: number) => `${n} этаж, свободно ${free}`,
    cell: (number: number, status: string) => `Кв. ${number}, ${status.toLowerCase()}`,
  },
  legend: {
    label: 'Статусы квартир на этаже',
  },
  card: {
    empty: 'Выберите свободную квартиру на плане или в шахматке слева.',
    rooms: 'Помещения',
    soldNote: 'Квартира продана',
    reservedNote:
      'Квартира забронирована — можно посмотреть в 3D и оставить заявку в лист ожидания.',
    close: 'Снять выбор',
  },
  apartment: {
    number: (n: number) => `Кв. ${n}`,
    floor: (n: number) => `${n} этаж`,
    rooms: (n: RoomCount) => (n === 0 ? 'Студия' : `${n}-комн.`),
    roomsShort: (n: RoomCount) => (n === 0 ? 'ст.' : `${n}к`),
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

/** Демо-квартира для тестов и примеров: кв. 51, 9 этаж, 2-комн., свободна. */
export const DEMO_APARTMENT_ID = 's1-f9-a3';
