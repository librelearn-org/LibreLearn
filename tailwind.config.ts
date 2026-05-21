import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

export default {
  content: [
    './app/**/*.{ts,tsx,js,jsx}',
    './stories/**/*.{ts,tsx,js,jsx,mdx}',
    './.storybook/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        polar: {
          50: '#ebf8ff',
          100: '#d1f0ff',
          200: '#a5e1ff',
          300: '#77d2ff',
          400: '#4ec4ff',
          500: '#2eb6ff',
          600: '#1996e6',
          700: '#0e75b8',
          800: '#095a8d',
          900: '#084b74',
        },
        librelearn: {
          50: "#CDFFE5",
          75: "#9FFFD3",
          100: "#70FEC0",
          200: "#1DE8A1",
          300: "#18CC8D",
          400: "#13B17A",
          500: "#0F9969",
          600: "#0B7F57",
          700: "#076745",
          800: "#044F34",
          900: "#023824",
        },
        admin: {
          900: '#000000',
          800: '#2a2a2a',
          700: '#3f3f3f',
          600: '#747474',
          500: '#9c9c9c',
          400: '#a8a8a8',
          300: '#b7b7b7',
          200: '#dbeafe',
          100: '#eff6ff',
          75: '#f0f7ff',
          50: '#f8fafc',
        },
      },
      // boxShadow: {
      //   'elevated': '0 10px 20px rgba(37, 99, 235, 0.25), 0 6px 6px rgba(37, 99, 235, 0.20)'
      // },
    },
  },
  plugins: [
    plugin(({ addBase, theme }) => {
      const librelearn = theme('colors.librelearn') as Record<string, string>
      addBase({
        ':root': Object.fromEntries(
          Object.entries(librelearn).map(([key, value]) => [
            `--color-librelearn-${key}`,
            value,
          ])
        ),
      })
    }),
  ],
} satisfies Config
