// events copied exactly from the original Post.svelte
// colors are names from assets/colors.js, or raw hex

// full-width horizontal bands
export const bands = [
  { label: 'WW1', start: '28 July 1914', end: '11 November 1918', color: 'rose', opacity: 0.4, dotted: false },
  { label: 'WW2', start: 'September 13 1939', end: 'September 2 1945', color: 'rose', opacity: 0.4, dotted: true },
]

// one array per 80px column, left-to-right
export const columns = [
  [
    { label: 'Royal York Hotel', start: '1927', end: '1929', color: 'blue', opacity: 0.5 },
    { label: 'City Hall', start: 'November 7 1961', end: 'September 13 1965', color: 'blue', opacity: 0.5 },
    { label: 'CN tower', start: 'August 20 1973', end: 'August 20 1976', color: 'blue', opacity: 0.5 },
    { label: 'Skydome', start: 'October 3, 1986', end: 'June 3 1989', color: 'blue', opacity: 0.5 },
    { label: 'BMO', start: 'March 29, 2006', end: 'April 28, 2007', color: 'blue', opacity: 0.5 },
  ],
  [
    { label: 'Line 1', start: 'October 3, 1945', end: 'March 30, 1954', color: '#d3d593', opacity: 0.7 },
    { label: 'Crosstown', start: 'July 28, 2010', end: 'jan 1 2023', color: 'orange', opacity: 0.7 },
  ],
  [
    { label: 'Maple Leaf Gardens', start: 'May 30, 1931', end: 'November 12, 1931', color: 'blue', opacity: 0.5 },
    { label: 'Line 2', start: 'November 1 1959', end: 'February 26, 1966', color: '#76a15a', opacity: 0.7 },
    { label: 'Sheppard', start: 'jan 1 1994', end: 'November 22, 2002', color: '#978BA3', opacity: 0.7 },
  ],
  [
    { label: 'Finch West', start: 'September 2017', end: 'jan 1 2023', color: 'purple', opacity: 0.7 },
    { label: 'Gardiner', start: 'jan 1 1955', end: 'jan 1 1963', color: 'grey', opacity: 0.7 },
  ],
  [
    { label: 'DVP', start: 'sept 1 1955', end: 'March 1, 1967', color: 'grey', opacity: 0.7 },
  ],
  [
    { label: 'Pearson 1', start: 'October 3, 1957', end: 'February 28, 1964', color: 'purple', opacity: 0.7 },
    { label: 'Terminal 2', start: '1970', end: 'June 15, 1972', color: 'purple', opacity: 0.7 },
    { label: 'Terminal 3', start: '1989', end: 'February 21 1991', color: 'purple', opacity: 0.7 },
  ],
]
