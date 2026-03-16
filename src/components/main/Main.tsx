import React, { useState, useEffect } from 'react';
import { Config } from '../../config/Config';
import { Tabs } from '../tabs/Tabs';
import { ItemTable } from '../table/ItemTable';
import './Main.css';

const sampleData: Record<string, Array<{ name: string; required: number; raw: number }>> = {
  'Fish': [
    { name: 'Salmon', required: 80, raw: 8 },
    { name: 'Tuna', required: 3, raw: 6 },
    { name: 'Cod', required: 2, raw: 4 },
  ],
  'Resources': [
    { name: 'Wood', required: 10, raw: 25 },
    { name: 'Stone', required: 15, raw: 30 },
    { name: 'Ore', required: 5, raw: 12 },
  ],
  'All': [
    { name: 'Salmon', required: 5, raw: 8 },
    { name: 'Tuna', required: 3, raw: 6 },
    { name: 'Wood', required: 10, raw: 25 },
    { name: 'Stone', required: 15, raw: 30 },
  ],
};

export function Main() {
  const [selectedCategory, setSelectedCategory] = useState(Config.getSelectedTab());

  useEffect(() => {
    const handleConfigChange = () => {
      setSelectedCategory(Config.getSelectedTab());
    };

    const unsubscribe = Config.getInstance().subscribe(handleConfigChange);
    return unsubscribe;
  }, []);

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
  };

  const categoryData = sampleData[selectedCategory] || [];

  return (
    <div className="container">
      <Tabs onCategoryChange={handleCategoryChange}>
        <section>
          <ItemTable items={categoryData} />
        </section>
      </Tabs>
    </div>
  );
}