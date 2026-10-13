// deterministic green gradient per product name
export const tile = (name: string) => {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  const hue = 120 + (h % 50);
  return { background: `linear-gradient(135deg, hsl(${hue} 70% 90%), hsl(${hue} 55% 68%))` };
};
