export type ID = string;

export type ISODateString = string;

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export type CursorPageParam = string | null;

export type Photo = {
  id: ID;
  url: string;
  blurhash?: string;
  width?: number;
  height?: number;
  position: number;
};
