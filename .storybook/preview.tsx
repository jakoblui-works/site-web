import type { Preview } from "@storybook/react-vite";
import "../src/styles.css";

// The site is dark-only (index.html sets the class), so stories render dark too.
document.documentElement.classList.add("dark");

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: "todo",
    },
  },
};

export default preview;
