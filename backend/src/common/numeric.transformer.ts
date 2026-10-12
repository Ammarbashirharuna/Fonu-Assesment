import { ValueTransformer } from 'typeorm';

export const numericTransformer: ValueTransformer = {
  to: (value?: number) => value,
  from: (value?: string | null) => (value == null ? value : parseFloat(value)),
};
