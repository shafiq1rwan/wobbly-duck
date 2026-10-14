"""Build the duck art checklist from the pinned IOC 15.2 source and repo assets."""
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
SOURCE = ROOT / 'docs/reference/ioc-master-v15.2-source.xlsx'
EXCLUDED = {'Cereopsis', 'Branta', 'Anser', 'Coscoroba', 'Cygnus', 'Plectropterus', 'Cyanochen', 'Alopochen', 'Neochen', 'Chloephaga'}
GENERATED = {
    'Mallard': ('duck-variants-v1/mallard-sheet.png', 'Generated; stylized male Mallard'),
    'Mandarin Duck': ('duck-variants-v2/mandarin-sheet.png', 'Generated; Mandarin-inspired'),
    'Tufted Duck': ('duck-variants-v2/tufted-sheet.png', 'Generated; stylized tufted design'),
    'Eurasian Wigeon': ('duck-variants-v2/wigeon-sheet.png', 'Generated inspiration only; provisional species mapping'),
}
BREEDS = ['Abacot Ranger', 'Aylesbury', 'Bali', 'Black East Indian', 'Blue Swedish', 'Buff Orpington', 'Call',
          'Campbell (Khaki)', 'Cayuga', 'Crested (large)', 'Crested (bantam)', 'Hook Bill', 'Indian Runner',
          'Magpie', 'Muscovy (domestic form)', 'Pekin', 'Rouen', 'Rouen Clair', 'Saxony', 'Silver Appleyard',
          'Silver Appleyard Miniature', 'Silver Bantam', 'Welsh Harlequin']
BREED_ASSETS = {'Pekin': 'duck-variants-v1/pekin-sheet.png', 'Campbell (Khaki)': 'duck-variants-v1/khaki-sheet.png'}

with zipfile.ZipFile(SOURCE) as archive:
    strings = [''.join(e.itertext()) for e in ET.fromstring(archive.read('xl/sharedStrings.xml'))]
    rows = ET.fromstring(archive.read('xl/worksheets/sheet1.xml')).findall('.//m:row', NS)
family = genus = ''
records = []
for row in rows:
    values = {}
    for cell in row:
        value = cell.find('m:v', NS)
        if value is not None:
            column = ''.join(c for c in cell.get('r') if c.isalpha())
            values[column] = strings[int(value.text)] if cell.get('t') == 's' else value.text
    family = values.get('D', family)
    genus = values.get('F', genus)
    if family == 'Anatidae' and 'G' in values and 'K' in values:
        records.append({'name': values['K'], 'scientific': genus + ' ' + values['G'],
                        'genus': genus, 'marker': values.get('I', '')})

ducks = [r for r in records if r['genus'] not in EXCLUDED]
living = [r for r in ducks if not r['marker']]
extinct = [r for r in ducks if r['marker']]
done = [r for r in living if r['name'] in GENERATED]
todo = [r for r in living if r['name'] not in GENERATED]
other = [r for r in records if r['genus'] in EXCLUDED]
assert len(records) == 174 and len(ducks) == 138
assert len({r['scientific'] for r in records}) == len(records)
assert len(done) == 4 and len(todo) == 128 and len(extinct) == 6
for relative in [v[0] for v in GENERATED.values()] + list(BREED_ASSETS.values()):
    assert (ROOT / 'assets-src' / relative).is_file(), relative

def asset_link(relative):
    return f'[PNG sheet](../assets-src/{relative})'

lines = [
    '# Worldwide duck catalogue and artwork checklist', '',
    'Updated: **14 October 2026**. Taxonomy pinned to **IOC World Bird List v15.2**. Artwork status reflects files present in this repository on that date.', '',
    'This is a complete species checklist within the explicit scope below, plus a separate domestic-breed checklist. It is not a claim to list every regional domestic breed, colour morph, hybrid, subspecies or prehistoric fossil duck.', '',
    '## Scope and counts', '',
    '“Duck” is a common grouping within Anatidae, rather than a single formal taxonomic rank. For a reproducible list, this catalogue includes IOC Anatidae species except the goose/swan genera listed in the appendix. It includes teal, wigeons, shovelers, pintails, pochards, scaup, eiders, scoters, goldeneyes, mergansers, shelducks, steamer ducks and pygmy geese (*Nettapus*). Pygmy geese are duck relatives commonly grouped with perching ducks despite their English names. [IOC family list](https://www.worldbirdnames.org/new/bow/waterfowl/), [San Diego Zoo: African Pygmy Goose](https://animals.sandiegozoo.org/animals/african-pygmy-goose).', '',
    '| Category | Already generated | Not generated | Total |',
    '| --- | ---: | ---: | ---: |',
    f'| Duck species without an IOC extinction marker | {len(done)} | {len(todo)} | {len(living)} |',
    f'| Duck species with an IOC extinction marker | 0 | {len(extinct)} | {len(extinct)} |',
    f'| Domestic breed/form entries in this checklist | 2 | {len(BREEDS) - 2} | {len(BREEDS)} |',
    '| Original yellow game character | Existing owner-supplied base art | — | 1 |', '',
    '**Six generated skin sheets** exist: Mallard, white Pekin, Khaki, Mandarin-inspired, tufted, and Wigeon-inspired. Four map to species inspirations and two to domestic breeds. These counts must not be added as though all six were separate wild species. Generated means the PNG exists; it does not mean the skin is enabled in gameplay.', '',
    'The **132 + 6** species count is calculated from the chosen IOC scope, not a universal number shared by every bird checklist. Extinction-marked entries include birds whose continued survival is disputed or unconfirmed; the marker alone is not a fresh conservation assessment. IOC distinguishes historical extinction (†) from earlier extinction (††). [IOC extinction notes](https://www.worldbirdnames.org/new/classification/extinct-birds/).', '',
    '## Already generated — wild-species inspirations', '',
    '| Duck | Scientific name | Artwork status | File |',
    '| --- | --- | --- | --- |',
]
for r in sorted(done, key=lambda r: r['name']):
    relative, status = GENERATED[r['name']]
    lines.append(f"| {r['name']} | *{r['scientific']}* | {status} | {asset_link(relative)} |")
lines += ['', 'The Wigeon sheet was requested as a chestnut-and-grey Wigeon-inspired skin, not a verified species illustration. It is provisionally tracked under Eurasian Wigeon because of that art direction. American and Chiloe Wigeons remain not generated. Orange bills/feet and simplified anatomy are game-style choices across these sheets.', '',
          '## Already generated — domestic breeds', '', '| Breed/design | Status | File |', '| --- | --- | --- |',
          f"| White Pekin | Generated stylized Pekin | {asset_link(BREED_ASSETS['Pekin'])} |",
          f"| Khaki Campbell-inspired brown duck | Generated stylized Khaki design | {asset_link(BREED_ASSETS['Campbell (Khaki)'])} |", '',
          'Pekin and Khaki Campbell are domestic breed entries, not two additional wild species. Most domestic breeds are Mallard-derived. Muscovy is separately listed as a wild species and a domestic form. [FAO: ducks](https://www.fao.org/poultry-production-products/production/poultry-species/ducks/), [FAO: domestic breeds](https://www.fao.org/4/y5169e/y5169e03.htm).', '',
          '## Not generated — worldwide duck species', '',
          'All **128** unmarked duck species without matching generated PNGs are listed below. Groups are practical catalogue groupings, not a new taxonomic classification.', '']

groups = [
    ('Whistling ducks', {'Dendrocygna'}),
    ('Shelducks', {'Radjah', 'Tadorna'}),
    ('River specialists, steamer ducks and other distinctive ducks', {'Thalassornis', 'Stictonetta', 'Hymenolaimus', 'Tachyeres', 'Merganetta', 'Malacorhynchus', 'Salvadorina', 'Chenonetta', 'Sarkidiornis'}),
    ('Perching, tropical and pygmy ducks', {'Cairina', 'Asarcornis', 'Pteronetta', 'Aix', 'Nettapus', 'Amazonetta', 'Callonetta'}),
    ('Dabbling ducks, teal, shovelers, wigeons and pintails', {'Lophonetta', 'Speculanas', 'Sibirionetta', 'Spatula', 'Mareca', 'Anas', 'Marmaronetta'}),
    ('Pochards, diving ducks and scaup', {'Netta', 'Aythya'}),
    ('Sea ducks, eiders, scoters, goldeneyes and mergansers', {'Polysticta', 'Camptorhynchus', 'Somateria', 'Histrionicus', 'Melanitta', 'Clangula', 'Bucephala', 'Mergellus', 'Lophodytes', 'Mergus'}),
    ('Stiff-tailed and other remaining ducks', {'Heteronetta', 'Nomonyx', 'Oxyura', 'Biziura', 'Rhodonessa'}),
]
listed = []
for title, genera in groups:
    group = sorted([r for r in todo if r['genus'] in genera], key=lambda r: r['name'])
    if not group:
        continue
    lines += [f'### {title} ({len(group)})', '', '| Done | Duck | Scientific name |', '| --- | --- | --- |']
    for r in group:
        lines.append(f"| [ ] | {r['name']} | *{r['scientific']}* |")
        listed.append(r['scientific'])
    lines.append('')
assert len(listed) == len(todo) and len(set(listed)) == len(todo)

lines += ['## Not generated — extinction-marked duck species', '',
          'These six entries carry an extinction marker in the pinned IOC source. Pink-headed Duck and Crested Shelduck require particular caution because “possibly extinct” and “extinct” treatments can differ between authorities. Artwork could still be made as an extinct/rare-species-inspired skin.', '',
          '| Done | Duck | Scientific name | IOC marker |', '| --- | --- | --- | --- |']
for r in sorted(extinct, key=lambda r: r['name']):
    lines.append(f"| [ ] | {r['name']} | *{r['scientific']}* | {r['marker']} |")
lines += ['', '## Not generated — domestic breed/form checklist', '',
          'This covers the duck entries in the Poultry Club breed gallery, with Khaki specified within Campbell. It is a useful bounded breed checklist, not an exhaustive global registry of regional breeds and commercial strains. Crested large/bantam and miniature entries are retained as separate gallery entries. [Poultry Club breed gallery](https://www.poultryclub.org/breeds/).', '',
          '| Done | Breed/form |', '| --- | --- |']
for breed in sorted(set(BREEDS) - set(BREED_ASSETS)):
    lines.append(f'| [ ] | {breed} |')
lines += ['', '## Existing original character and animation assets', '',
          '| Item | Status | File |', '| --- | --- | --- |',
          '| Original yellow duck | Owner-supplied base sprite; no species assigned | [Base PNG](../assets-src/duck-sheet.png) |',
          '| Land reaction | Generated four-frame animation; not a new duck type | [Land PNG](../assets-src/duck-reactions-v1/duck-land-sheet.png) |',
          '| Hurt reaction | Generated four-frame animation; not a new duck type | [Hurt PNG](../assets-src/duck-reactions-v1/duck-hurt-sheet.png) |', '',
          'Ducklings are life stages/characters rather than separate species. A concept image showing ducklings is not counted as a finished duckling spritesheet.', '',
          '## Appendix: related Anatidae outside the duck scope', '',
          'The following **36** IOC entries are excluded as geese/sheldgeese/swans under this catalogue rule. They complete the audit of all 174 Anatidae species in the pinned source; they are not counted as unfinished duck artwork.', '',
          'Excluded genera: ' + ', '.join(f'*{g}*' for g in sorted(EXCLUDED)) + '.', '',
          '| Related species | Scientific name | IOC extinction marker |', '| --- | --- | --- |']
for r in sorted(other, key=lambda r: r['name']):
    lines.append(f"| {r['name']} | *{r['scientific']}* | {r['marker'] or '—'} |")
lines += ['', '## Sources and maintenance', '',
          '- [IOC World Bird List master lists, v15.2](https://www.worldbirdnames.org/new/ioc-lists/master-list-2/).',
          '- [Downloaded official master XLSX](https://worldbirdnames.org/master_ioc_list_v15.2.xlsx); [pinned local copy](reference/ioc-master-v15.2-source.xlsx). Species names/markers are factual data extracted from this file.',
          '- [IOC waterfowl family page](https://www.worldbirdnames.org/new/bow/waterfowl/).',
          '- [IOC extinct-bird conventions](https://www.worldbirdnames.org/new/classification/extinct-birds/).',
          '- [Poultry Club duck breed gallery](https://www.poultryclub.org/breeds/).',
          '- [FAO domestic ducks](https://www.fao.org/poultry-production-products/production/poultry-species/ducks/).',
          '- Repo art notes: [v1](assets/duck-variants-v1/README.md), [v2](assets/duck-variants-v2/README.md).', '',
          'To update the catalogue, add confirmed asset mappings to `tools/build-duck-catalog.py` and run `python tools/build-duck-catalog.py`. The script validates file existence, duplicate scientific names and coverage of every included species. Update the pinned source and expected counts deliberately when changing taxonomy versions.', '']
(ROOT / 'docs/DUCK_CATALOG.md').write_text('\n'.join(lines), encoding='utf-8')
print(f'Wrote docs/DUCK_CATALOG.md: {len(done)} generated species inspirations, {len(todo)} unmarked species to do, {len(extinct)} extinction-marked, 2 generated breeds, {len(BREEDS)-2} other breed/form entries.')
