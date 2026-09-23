import test from 'node:test';
import assert from 'node:assert/strict';
import { SRC } from '../../src/core/data.js';
import { resolveText } from '../../src/modules/mealprep.js';

const blob = JSON.stringify({ phases: SRC.mealprep.phases, cards: SRC.mealprep.cards, tables: SRC.mealprep.tables, why: SRC.mealprep.why });

test('Meal Prep: struktura i kompletność', () => {
  assert.equal(SRC.mealprep.cards.length, 12);
  assert.equal(SRC.mealprep.phases.length, 5);
  assert.equal(SRC.mealprep.tables.length, 4);
  assert.equal(SRC.mealprep.why.length, 11);
});

test('D-013: żadnego progu pakowania; kontrola > 63 °C', () => {
  assert.ok(!/(?<!1)\b(?:85|75) ?°C/.test(blob), 'brak progu 85/75 °C (185 °C air fryera dozwolone)');
  assert.ok(blob.includes('prosto z patelni'));
  assert.ok(blob.includes('> 63 °C'));
});

test('D-020, D-022, D-001, I-3: nazwy, pomidorki, melatonina, kubki', () => {
  assert.ok(blob.includes('Białko WPC') && !blob.includes('Odżywka białkowa'));
  assert.ok(blob.includes('melatonina 1 mg') && !blob.includes('0,5–1 mg'));
  const naczynia = SRC.mealprep.tables[0].rows;
  const contigo = n => naczynia.find(r => r[0].startsWith('Contigo') && r[0].includes(`#${n}`))[1];
  assert.match(contigo(1), /herbata/i, 'I-3: Contigo #1 to herbata');
  assert.match(contigo(2), /[Kk]awa/, 'I-3: Contigo #2 to kawa');
  assert.match(naczynia.find(r => r[0].startsWith('Rockland') && r[0].includes('#1'))[1], /gorąca baza makaronowa/, 'pozostałe wiersze bez zmian');
  assert.ok(!naczynia.find(r => r[0].includes('320 ml'))[1].includes('szpinak'), 'szpinak rozmraża się w 520 ml (I-3)');
});

test('D-035: brak danych z badań w danych modułu; znaczniki {private:N}', () => {
  assert.ok(!/ferrytyn|ng\/ml|% RDA/i.test(blob));
  assert.equal(SRC.mealprep.private_fragments, 2);
  assert.ok(blob.includes('{private:1}') && blob.includes('{private:2}'));
});

test('ilości podstawiane z planu diety wg fazy (D-003)', () => {
  const step = SRC.mealprep.cards.find(c => c.id === 'k2').blocks.find(b => b.type === 'steps').items[0];
  assert.ok(step.includes('{platki_owsiane}'));
  assert.match(resolveText(step, 0, 'T'), /płatki owsiane 70 g/);
  assert.match(resolveText(step, 1, 'T'), /płatki owsiane 85 g/);
  assert.match(resolveText(step, 2, 'T'), /płatki owsiane 85 g/);
  const lunch = SRC.mealprep.cards.find(c => c.id === 'k4').blocks.flatMap(b => b.items || []).find(t => t.includes('{penne}'));
  assert.match(resolveText(lunch, 2, 'T'), /penne 100 g/);
});

test('pozycje nieobecne w dniu nietreningowym są oznaczane, a nie zmyślane', () => {
  const koktajl = SRC.mealprep.cards.find(c => c.id === 'k6').blocks.flatMap(b => b.items || []).find(t => t.includes('{kefir}'));
  assert.match(resolveText(koktajl, 0, 'T'), /kefir 200 ml/);
  assert.match(resolveText(koktajl, 0, 'NT'), /\(brak w planie: Kefir 1,5%\)/);
});

test('{private:N} zastępowane treścią z pakietu, bez pakietu — komunikat', () => {
  const t = 'Uzasadnienie {private:1} dalej.';
  assert.match(resolveText(t, 0, 'T', null), /pakiecie prywatnym — zaimportuj/);
  const pack = { sections: [{ id: 'mp-why', blocks: [{ marker: 1, text: 'TREŚĆ' }] }] };
  assert.equal(resolveText(t, 0, 'T', pack), 'Uzasadnienie TREŚĆ dalej.');
});
