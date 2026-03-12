import Reasct from 'react';
import './index.css'
import { Header } from './components/header/Header';
import { Main } from './components/main/Main';
import { Footer } from './components/footer/Footer';
import {ThemeProvider, createTheme} from "@mui/material/styles";
import {CssBaseline} from "@mui/material";
import {Config} from "./config/Config.ts";

const configuredTheme =  createTheme({
    colorSchemes: {
        dark: true,
        light: true,
    },
});

export function App() {
  return (
      <ThemeProvider theme={configuredTheme} defaultMode={Config.getTheme()}>
          <CssBaseline/>
          <div className="app">
            <Header />
            <Main>
              <section>
                <h1>Welcome</h1>
              </section>
            </Main>
            <Footer />
          </div>
      </ThemeProvider>
  );
}