/* 像素小動物組徽：每隻 12 欄，每個字元一格；'.' 為透明，其餘字元查 pal 色表 */
(function () {
  'use strict';

  const K = '#2b2233', W = '#fffaf2', P = '#ff9fb2';
  const ICONS = [
    { id: 'cat', name: '橘貓', pal: { k: K, o: '#f4a03a', w: W, p: P }, rows: [
      '.kk......kk.',
      'kopk....kpok',
      'koopkkkkpook',
      'kooooooooook',
      'kooooooooook',
      'kowkoooowkok',
      'kokkooookkok',
      'kpoowwwwoopk',
      'kooowkkwoook',
      '.koowwwwook.',
      '..kkooookk..',
      '....kkkk....'] },
    { id: 'dog', name: '小狗', pal: { k: K, c: '#f7e1b5', b: '#9a5b34', w: W, p: P }, rows: [
      '..kkkkkkkk..',
      '.kcccccccck.',
      'kbbccccccbbk',
      'kbbccccccbbk',
      'kbbwkccwkbbk',
      'kbbkkcckkbbk',
      'kbbpcwwcpbbk',
      'kbkcwkkwckbk',
      '.kkcwwwwckk.',
      '..kcccccck..',
      '...kkkkkk...'] },
    { id: 'rabbit', name: '兔兔', pal: { k: K, w: '#fdfbff', p: P }, rows: [
      '..kk....kk..',
      '.kwpk..kpwk.',
      '.kwpk..kpwk.',
      '.kwpk..kpwk.',
      '.kwwkkkkwwk.',
      'kwwwwwwwwwwk',
      'kwkkwwwwkkwk',
      'kwkkwwwwkkwk',
      'kpwwwkkwwwpk',
      '.kwwwwwwwwk.',
      '..kkkkkkkk..'] },
    { id: 'bear', name: '小熊', pal: { k: K, b: '#a86b3c', l: '#e8c39e', w: W, p: P }, rows: [
      '.kkk....kkk.',
      'kblbk..kblbk',
      'kbbbkkkkbbbk',
      'kbbbbbbbbbbk',
      'kbwkbbbbwkbk',
      'kbkkbbbbkkbk',
      'kpbbllllbbpk',
      'kbbllkkllbbk',
      '.kbbllllbbk.',
      '..kkbbbbkk..',
      '....kkkk....'] },
    { id: 'penguin', name: '企鵝', pal: { k: K, n: '#34405e', w: W, y: '#f6b93b', p: P }, rows: [
      '...kkkkkk...',
      '..knnnnnnk..',
      '.knnnnnnnnk.',
      'knnwwnnwwnnk',
      'knwwwwwwwwnk',
      'knwkkwwkkwnk',
      'knwkkwwkkwnk',
      'knpwwyywwpnk',
      'knwwwyywwwnk',
      '.knwwwwwwnk.',
      '..kkkkkkkk..'] },
    { id: 'frog', name: '青蛙', pal: { k: K, g: '#7ccf6b', w: W, p: P }, rows: [
      '.kkk....kkk.',
      'kwwwk..kwwwk',
      'kwkwkkkkwkwk',
      '.kkkggggkkk.',
      'kggggggggggk',
      'kpggggggggpk',
      'kggkggggkggk',
      'kgggkkkkgggk',
      '.kggggggggk.',
      '..kkkkkkkk..'] },
    { id: 'fox', name: '狐狸', pal: { k: K, o: '#f27c38', w: W }, rows: [
      'kk........kk',
      'kok......kok',
      'kowk....kwok',
      'koookkkkoook',
      'kooooooooook',
      'kowkoooowkok',
      'kokkooookkok',
      'kwwwoooowwwk',
      '.kwwwkkwwwk.',
      '..kwwwwwwk..',
      '...kkkkkk...'] },
    { id: 'chick', name: '小雞', pal: { k: K, y: '#ffd84a', o: '#f39c12', p: P }, rows: [
      '....k..k....',
      '.....kk.....',
      '...kkyykk...',
      '..kyyyyyyk..',
      '.kyyyyyyyyk.',
      '.kykkyykkyk.',
      '.kykkyykkyk.',
      'kpyyyooyyypk',
      'kyyyyooyyyyk',
      '.kyyyyyyyyk.',
      '..kkkkkkkk..'] },
    { id: 'panda', name: '熊貓', pal: { k: K, w: W, p: P }, rows: [
      '.kk......kk.',
      'kkkkkkkkkkkk',
      'kkkwwwwwwkkk',
      'kwwwwwwwwwwk',
      'kwkkkwwkkkwk',
      'kwkwkwwkwkwk',
      'kwkkkwwkkkwk',
      'kpwwwkkwwwpk',
      '.kwwwwwwwwk.',
      '..kkkkkkkk..'] },
    { id: 'pig', name: '小豬', pal: { k: K, p: '#f8a5c2', r: '#e07a9a', w: W }, rows: [
      '.kk......kk.',
      'kprk....krpk',
      'kpprkkkkrppk',
      'kppppppppppk',
      'kpwkppppwkpk',
      'kpkkppppkkpk',
      'kppprrrrpppk',
      'kpprkrrkrppk',
      '.kpprrrrppk.',
      '..kkppppkk..',
      '....kkkk....'] },
  ];

  const NS = 'http://www.w3.org/2000/svg';
  /* 畫成 SVG：同色相鄰格合併成一條，12×12 置中 */
  function iconSVG(id, label) {
    const ic = ICONS.find((x) => x.id === id);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 12 12');
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('class', 'pixel');
    if (label) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label); } else svg.setAttribute('aria-hidden', 'true');
    if (!ic) return svg;
    const top = Math.floor((12 - ic.rows.length) / 2);
    ic.rows.forEach((row, y) => {
      for (let x = 0; x < row.length;) {
        const ch = row[x]; let len = 1;
        while (row[x + len] === ch) len++;
        if (ch !== '.' && ic.pal[ch]) {
          const r = document.createElementNS(NS, 'rect');
          r.setAttribute('x', x); r.setAttribute('y', y + top);
          r.setAttribute('width', len); r.setAttribute('height', 1);
          r.setAttribute('fill', ic.pal[ch]);
          svg.append(r);
        }
        x += len;
      }
    });
    return svg;
  }

  window.PIXEL_ICONS = { list: ICONS, svg: iconSVG, byId: (id) => ICONS.find((x) => x.id === id) };
})();
