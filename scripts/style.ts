/** Terminal colour helpers for the command-line scripts. Colour is dropped when stdout is not a TTY or NO_COLOR is set. */
const ESC = String.fromCharCode(27);
const enabled = process.stdout.isTTY === true && !process.env.NO_COLOR;

function wrap(code: string): (text: string) => string {
  const open = `${ESC}[${code}m`;
  const close = `${ESC}[0m`;
  return (text: string) => (enabled ? `${open}${text}${close}` : text);
}

export const style = {
  dim: wrap('2'),
  bold: wrap('1'),
  red: wrap('31'),
  green: wrap('32'),
  yellow: wrap('33'),
  cyan: wrap('36'),
};
