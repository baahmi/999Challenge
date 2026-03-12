import Reasct from 'react';
import './index.css'
import { Header } from './components/header/Header';
import { Main } from './components/main/Main';
import { Footer } from './components/footer/Footer';

export function App() {
  return (
      <div className="app">
        <Header />
        <Main>
          {/* Put your page routes or content here */}
          <section>
            <h1>Welcome</h1>
          </section>
        </Main>
        <Footer />
      </div>
  );
}