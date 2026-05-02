
export interface SavedCard {
  id: string;
  brand: string;
  last_four: string;
  expiration_month: number;
  expiration_year: number;
  holder_name: string;
  type: 'credit_card' | 'debit_card';
  // We'll store the full number and details encrypted or just raw if the user insists on "local" security.
  // For "pre-filling automatically", we need the data.
  // However, for security, we should probably only store the full number if really needed.
  // But let's follow the requirement: "saved by local host... prefilled automatically".
  full_number?: string; 
}

const STORAGE_KEY = 'instaboost_saved_cards';

export const getLocalCards = (): SavedCard[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const saveLocalCard = (card: SavedCard) => {
  const cards = getLocalCards();
  const exists = cards.find(c => c.id === card.id || (c.last_four === card.last_four && c.brand === card.brand && c.expiration_month === card.expiration_month));
  if (!exists) {
    cards.push(card);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  }
};

export const removeLocalCard = (id: string | number) => {
  const cards = getLocalCards();
  const idStr = String(id);
  const filtered = cards.filter(c => String(c.id) !== idStr);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
};
