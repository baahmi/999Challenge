import React from 'react';
import './HelpPage.css';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="help-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function HelpPage() {
  return (
    <div className="help-page">
      <div className="help-header">
        <h1>999 Challenge Help</h1>
        <p>
          Track progress toward keeping a full stack of every required item while accounting for items already used in
          cooking, crafting, processing, geodes, troves, bait, smoked fish, wine, and quality-specific goals.
        </p>
      </div>

      <div className="help-grid">
        <Section title="Basic Workflow">
          <ol>
            <li>Upload a Stardew Valley save file with the upload button in the header.</li>
            <li>Use Overview to scan category progress.</li>
            <li>Open a category tab to inspect individual item rows.</li>
            <li>Hover a row for recipes, dependencies, shops, notes, and craftable counts.</li>
            <li>Upload later saves to update progress and review changes in the journal/diff tools.</li>
          </ol>
        </Section>

        <Section title="Search">
          <p>
            Press <kbd>/</kbd>, type a tab or item name, then press <kbd>Enter</kbd>. Use <kbd>Arrow Up</kbd> and
            <kbd>Arrow Down</kbd> to change the selected result. Selecting an item jumps to the tab that contains it.
          </p>
          <p>
            Results prefer exact tab matches, then names starting with the query, then word-prefix matches, then partial
            matches.
          </p>
        </Section>

        <Section title="Columns">
          <dl>
            <dt>Required</dt>
            <dd>The challenge target for the item, including extra copies needed as ingredients.</dd>
            <dt>Raw</dt>
            <dd>What is currently in your save inventory/chests for that item.</dd>
            <dt>Total</dt>
            <dd>Progress that counts toward the requirement: raw count plus items already consumed into dependents.</dd>
            <dt>Needed</dt>
            <dd>How many more countable items are needed. In highest-quality mode, wrong-quality stacks do not reduce this.</dd>
            <dt>Gold / Qi</dt>
            <dd>Estimated purchase cost for missing items when shop data is known.</dd>
          </dl>
        </Section>

        <Section title="Row Colors">
          <dl>
            <dt>Green</dt>
            <dd>The row is complete with the required stack/quality.</dd>
            <dt>Blue</dt>
            <dd>A complete stack exists, but not in the quality tier that currently counts.</dd>
            <dt>Yellow</dt>
            <dd>The item itself is available, but recipes or dependent items using it are not finished yet.</dd>
            <dt>Progress fill</dt>
            <dd>The name cell shows partial progress when the full row is not in a special state.</dd>
          </dl>
        </Section>

        <Section title="Quality Rules">
          <p>
            The default quality mode is highest. Items that cannot have useful quality are counted normally. Items with a
            known highest-quality target only count the relevant tier for progress.
          </p>
          <ul>
            <li>Cooking outputs count gold quality.</li>
            <li>Crabpot-only fish count silver quality.</li>
            <li>Fish, forage-capable shellfish, flowers, wine, animal products, and most preserved quality items count iridium quality.</li>
            <li>Smoked fish keeps the input fish quality, so its target follows the fish used to make it.</li>
            <li>Cooking/crafting ingredient rows such as Oil, Wheat Flour, Egg: Extra, and Milk: Extra do not require quality themselves.</li>
          </ul>
        </Section>

        <Section title="Extra Rows">
          <p>
            Rows such as Egg: Extra, Milk: Extra, Fish: Extra, and flower Extra rows represent surplus that can be used for
            recipes after the base item stacks are complete. They are progress helpers and are excluded from summary raw
            totals to avoid double counting.
          </p>
        </Section>

        <Section title="Data Notes">
          <p>
            The app uses bundled item, recipe, price, and trove data. If the game changes or the generated data is fixed,
            refreshing the app should use the latest bundled data. Category order and app settings are stored locally.
          </p>
        </Section>
      </div>
    </div>
  );
}
