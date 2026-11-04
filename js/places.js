'use strict';

(function (root) {
  var KINDS = [
    { id: 'all', label: 'All' },
    { id: 'eat', label: 'Eat' },
    { id: 'shop', label: 'Shops' },
    { id: 'service', label: 'Services' },
    { id: 'see', label: 'See & do' },
    { id: 'room', label: 'Rooms' },
    { id: 'rest', label: 'Restrooms' },
    { id: 'move', label: 'Getting around' },
    { id: 'park', label: 'Parking' }
  ];

  var KIND_LABEL = {
    eat: 'Eat',
    shop: 'Shop',
    service: 'Service',
    see: 'See & do',
    room: 'Room',
    rest: 'Restroom',
    move: 'Getting around',
    park: 'Parking'
  };

  var CROWD = {
    quiet: { label: 'Usually quiet', level: 1 },
    steady: { label: 'Usually steady', level: 2 },
    busy: { label: 'Usually busy', level: 3 }
  };

  var GUIDE = {
    'Cafe': { kind: 'eat', crowd: 'steady', about: 'Coffee, tea, pastries, and cookies to take away or sit with.', offers: ['Coffee', 'Tea', 'Pastries', 'Cookies'] },
    'Food Court': { kind: 'eat', crowd: 'busy', about: 'Several counters for a quick meal.', offers: ['Meals', 'Snacks', 'Drinks'] },
    'Dining Terrace': { kind: 'eat', crowd: 'steady', about: 'Sit-down dining on the terrace.', offers: ['Meals', 'Drinks'] },
    'Sky Lounge': { kind: 'eat', crowd: 'steady', about: 'A quiet lounge for a drink and a view.', offers: ['Drinks', 'Light bites'] },
    'Bookstore': { kind: 'shop', crowd: 'quiet', about: 'Books, magazines, and stationery.', offers: ['Books', 'Magazines', 'Stationery'] },
    'Florist': { kind: 'shop', crowd: 'quiet', about: 'Fresh flowers and small gifts.', offers: ['Flowers', 'Gifts'] },
    'Mobile Shop': { kind: 'shop', crowd: 'steady', about: 'Phones, cases, and accessories.', offers: ['Phones', 'Accessories'] },
    'Eyewear': { kind: 'shop', crowd: 'quiet', about: 'Glasses and sunglasses.', offers: ['Glasses', 'Sunglasses'] },
    'Boutique': { kind: 'shop', crowd: 'steady', about: 'A small clothing shop.', offers: ['Clothing'] },
    'Dresses': { kind: 'shop', crowd: 'steady', about: 'Dresses and occasion wear.', offers: ['Dresses'] },
    'Beauty': { kind: 'shop', crowd: 'steady', about: 'Skincare and makeup.', offers: ['Skincare', 'Makeup'] },
    'Perfume': { kind: 'shop', crowd: 'steady', about: 'Fragrance and gift sets.', offers: ['Fragrance'] },
    'Menswear': { kind: 'shop', crowd: 'steady', about: 'Clothing for men.', offers: ['Menswear'] },
    'Jewelry': { kind: 'shop', crowd: 'quiet', about: 'Jewelry and small gifts.', offers: ['Jewelry'] },
    'Watches': { kind: 'shop', crowd: 'quiet', about: 'Watches and straps.', offers: ['Watches'] },
    'Leather': { kind: 'shop', crowd: 'quiet', about: 'Leather bags and belts.', offers: ['Bags', 'Belts'] },
    'Sportswear': { kind: 'shop', crowd: 'steady', about: 'Sports clothing and shoes.', offers: ['Sportswear', 'Shoes'] },
    'Bags': { kind: 'shop', crowd: 'steady', about: 'Bags and travel accessories.', offers: ['Bags'] },
    'Shoe Shop': { kind: 'shop', crowd: 'steady', about: 'Everyday and dress shoes.', offers: ['Shoes'] },
    'Groceries': { kind: 'shop', crowd: 'busy', about: 'Everyday food and drinks.', offers: ['Groceries', 'Drinks'] },
    'Electronics': { kind: 'shop', crowd: 'steady', about: 'Small electronics and accessories.', offers: ['Electronics'] },
    'Home Store': { kind: 'shop', crowd: 'steady', about: 'Home goods and small furnishings.', offers: ['Home goods'] },
    'Toy Hall': { kind: 'shop', crowd: 'busy', about: 'Toys and games.', offers: ['Toys', 'Games'] },
    'Hobby Shop': { kind: 'shop', crowd: 'quiet', about: 'Crafts and hobby supplies.', offers: ['Crafts', 'Hobbies'] },
    'Market Hall': { kind: 'shop', crowd: 'busy', about: 'A hall of small market stalls.', offers: ['Market stalls'] },
    'Pharmacy': { kind: 'service', crowd: 'steady', about: 'Medicine and everyday health items.', offers: ['Medicine', 'Health'] },
    'Bank': { kind: 'service', crowd: 'steady', about: 'A bank counter.', offers: ['Banking'] },
    'Travel Desk': { kind: 'service', crowd: 'quiet', about: 'Tickets and travel help.', offers: ['Tickets', 'Travel help'] },
    'Customer Service': { kind: 'service', crowd: 'steady', about: 'Help with the building and lost items.', offers: ['Help desk'] },
    'Information': { kind: 'service', crowd: 'steady', about: 'Ask here for a place, a floor, or the way.', offers: ['Directions', 'Help'] },
    'Clinic': { kind: 'service', crowd: 'quiet', about: 'A small clinic.', offers: ['Clinic'] },
    'Consultation': { kind: 'service', crowd: 'quiet', about: 'A private consultation room.', offers: ['Appointments'] },
    'Reception': { kind: 'service', crowd: 'steady', about: 'The front desk.', offers: ['Front desk'] },
    'Records': { kind: 'room', crowd: 'quiet', about: 'Records storage.', offers: [] },
    'Print Room': { kind: 'service', crowd: 'quiet', about: 'Printing and copying.', offers: ['Printing', 'Copying'] },
    'Mail Room': { kind: 'service', crowd: 'quiet', about: 'Mail and parcels.', offers: ['Mail'] },
    'Repair Desk': { kind: 'service', crowd: 'quiet', about: 'Drop-off for repairs.', offers: ['Repairs'] },
    'Parts Counter': { kind: 'service', crowd: 'quiet', about: 'Spare parts over the counter.', offers: ['Parts'] },
    'Workshop': { kind: 'service', crowd: 'quiet', about: 'A working workshop.', offers: ['Workshop'] },
    'Cinema': { kind: 'see', crowd: 'busy', about: 'Film screenings.', offers: ['Films'] },
    'Family Arcade': { kind: 'see', crowd: 'busy', about: 'Games for families.', offers: ['Games'] },
    'Leisure Hall': { kind: 'see', crowd: 'steady', about: 'An open hall for leisure.', offers: ['Leisure'] },
    'Library': { kind: 'see', crowd: 'quiet', about: 'A quiet place to read.', offers: ['Reading'] },
    'Lobby': { kind: 'see', crowd: 'busy', about: 'The main arrival hall.', offers: [] },
    'Waiting Room': { kind: 'room', crowd: 'steady', about: 'A place to wait.', offers: [] },
    'Open Office': { kind: 'room', crowd: 'steady', about: 'An open working area.', offers: [] },
    'Conference Room': { kind: 'room', crowd: 'quiet', about: 'A room for meetings.', offers: ['Meetings'] },
    'Meeting Room': { kind: 'room', crowd: 'quiet', about: 'A room for meetings.', offers: ['Meetings'] },
    'Board Room': { kind: 'room', crowd: 'quiet', about: 'A room for board meetings.', offers: ['Meetings'] },
    'Training Room': { kind: 'room', crowd: 'quiet', about: 'A room for training.', offers: ['Training'] },
    'Director Office': { kind: 'room', crowd: 'quiet', about: 'A private office.', offers: [] }
  };

  var RULES = [
    ['park', /\bbay\b|parking/i],
    ['rest', /restroom|toilet|washroom|\bwc\b|bathroom/i],
    ['move', /elevator|lift|escalator|stair/i],
    ['eat', /cafe|coffee|restaurant|dining|food|kitchen|bakery|lounge|canteen/i],
    ['shop', /shop|store|boutique|market|retail|grocery|pharmacy/i],
    ['see', /cinema|arcade|museum|gallery|library|hall|lobby|atrium/i],
    ['service', /bank|clinic|desk|service|reception|information|office/i]
  ];

  function fromName(name) {
    var text = String(name || '');
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i][1].test(text)) return RULES[i][0];
    }
    return 'room';
  }

  function listOf(value) {
    if (Array.isArray(value)) return value.map(function (item) { return String(item).trim(); }).filter(Boolean);
    if (typeof value === 'string' && value.trim()) return value.split(/[,;|]/).map(function (item) { return item.trim(); }).filter(Boolean);
    return [];
  }

  var ICON_RULES = [
    ['rest', /restroom|toilet|washroom|\bwc\b|bathroom|\bbath\b/i],
    ['elevator', /elevator|\blift\b/i],
    ['escalator', /escalator/i],
    ['stair', /stair/i],
    ['park', /\bbay\b|parking|garage/i],
    ['cafe', /cafe|coffee/i],
    ['eat', /food|restaurant|dining|kitchen|bakery|canteen/i],
    ['pharmacy', /pharmac/i],
    ['bank', /\bbank\b|\batm\b/i],
    ['clinic', /clinic|hospital|medical/i],
    ['book', /book|library/i],
    ['flower', /florist|flower/i],
    ['grocery', /grocer|market|supermarket/i],
    ['cinema', /cinema|film|movie/i],
    ['clothing', /boutique|dress|menswear|cloth|fashion|shoe|bag|leather|sportswear/i],
    ['beauty', /beauty|perfume|cosmetic|makeup/i],
    ['phone', /mobile|phone|electronic/i],
    ['glasses', /eyewear|optic|glass/i],
    ['jewelry', /jewel|watch/i],
    ['travel', /travel|ticket/i],
    ['info', /information|\binfo\b/i],
    ['service', /reception|customer|service|desk|mail|print|repair|workshop/i]
  ];

  var KIND_ICON = {
    eat: 'eat',
    shop: 'shop',
    service: 'service',
    see: 'see',
    room: 'room',
    rest: 'rest',
    move: 'move',
    park: 'park'
  };

  function svg(body) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + body + '</svg>';
  }

  var GLYPHS = {
    bank: { color: '#1A73E8', svg: svg('<path fill="currentColor" d="M12 2 2 8v2.4h20V8L12 2zM4.2 12.2h3.4V19H4.2v-6.8zm6.1 0h3.4V19h-3.4v-6.8zm6.1 0h3.4V19h-3.4v-6.8zM2 20.2h20V22H2v-1.8z"/>') },
    cafe: { color: '#E8710A', svg: svg('<path fill="currentColor" d="M4 6h12.2v7.2A4.6 4.6 0 0 1 11.6 18H8.6A4.6 4.6 0 0 1 4 13.2V6zm12.2 1.6h2.4a3.2 3.2 0 0 1 0 6.4h-2.4V7.6zM5.5 20h11v2h-11v-2z"/>') },
    eat: { color: '#E8710A', svg: svg('<path fill="currentColor" d="M6 2h2.4v6.2H11V2h2.4v7c0 1.7-1.5 2.8-3 3V22H9V12c-1.5-.2-3-1.3-3-3V2zm9.2 1.2C17.6 5 18 7.4 18 9.6V22h-2.6V3.2h-.2z"/>') },
    shop: { color: '#9334E6', svg: svg('<path fill="currentColor" d="M7 8h10l-1 12H8L7 8zm2.1-1.4A2.9 2.9 0 0 1 12 3.6a2.9 2.9 0 0 1 2.9 3H13.4a1.4 1.4 0 0 0-2.8 0H9.1z"/>') },
    pharmacy: { color: '#188038', svg: svg('<path fill="currentColor" d="M9.2 2h5.6v7.2H22v5.6h-7.2V22H9.2v-7.2H2v-5.6h7.2V2z"/>') },
    clinic: { color: '#D93025', svg: svg('<path fill="currentColor" d="M9.2 2h5.6v7.2H22v5.6h-7.2V22H9.2v-7.2H2v-5.6h7.2V2z"/>') },
    rest: { color: '#00796B', svg: svg('<path fill="currentColor" d="M12 2.2a3.1 3.1 0 1 1 0 6.2 3.1 3.1 0 0 1 0-6.2zM6.4 10.2h11.2c.4 2.2-.2 3.4-1.6 4l.2 7.6h-3.1v-5.2h-2.2V21.8H7.8l.2-7.6c-1.4-.6-2-1.8-1.6-4z"/>') },
    park: { color: '#1A73E8', svg: svg('<path fill="currentColor" d="M7 3h6.4a4.6 4.6 0 0 1 0 9.2H10.2V21H7V3zm3.2 2.4v4.4h3a2.2 2.2 0 0 0 0-4.4h-3z"/>') },
    car: { color: '#15803D', svg: svg('<path fill="currentColor" d="M6.2 11.2 7.8 7h8.4l1.6 4.2H19a2 2 0 0 1 2 2V17h-2.2a2.3 2.3 0 0 1-4.4 0H9.6a2.3 2.3 0 0 1-4.4 0H3v-3.8a2 2 0 0 1 2-2h1.2z"/>') },
    book: { color: '#5E35B1', svg: svg('<path fill="currentColor" d="M4 4.2h6.4A3 3 0 0 1 13.4 7v12.2H7.6A3.6 3.6 0 0 0 4 22.8V4.2zm16 0h-6.2V19h2.4a3 3 0 0 1 3 3V4.2h.8z"/>') },
    flower: { color: '#C2185B', svg: svg('<g fill="currentColor"><circle cx="12" cy="12" r="2.7"/><circle cx="12" cy="4.6" r="3.15"/><circle cx="12" cy="19.4" r="3.15"/><circle cx="4.6" cy="12" r="3.15"/><circle cx="19.4" cy="12" r="3.15"/></g>') },
    grocery: { color: '#188038', svg: svg('<path fill="currentColor" d="M6.2 8h11.6l1.2 3.2H5L6.2 8zM4.4 12.6h15.2l-.9 8.2H5.3l-.9-8.2zM8.4 3.2h2.4v4.2H8.4V3.2zm4.8 0h2.4v4.2h-2.4V3.2z"/>') },
    cinema: { color: '#5E35B1', svg: svg('<path fill="currentColor" d="M3 7.2h18V19H3V7.2zm2.2 2v2.4h2.4V9.2H5.2zm3.8 0v2.4h2.4V9.2H9zm3.8 0v2.4h2.4V9.2h-2.4zm3.8 0v2.4H19V9.2h-2.4zM5.2 14.6V17h13.6v-2.4H5.2z"/>') },
    clothing: { color: '#9334E6', svg: svg('<path fill="currentColor" d="M8.2 6.2 12 3.4l3.8 2.8 2.6 2.2-2.4 2V20H8V10.4l-2.4-2 2.6-2.2z"/>') },
    beauty: { color: '#C2185B', svg: svg('<path fill="currentColor" d="m12 2.2 2.1 6.2H20l-4.8 3.6 1.8 6L12 14.6 6.9 18l1.9-6L4 8.4h5.9L12 2.2z"/>') },
    phone: { color: '#1A73E8', svg: svg('<path fill="currentColor" d="M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm2.4 15.6h3.2V20h-3.2v-2.4z"/>') },
    glasses: { color: '#5F6368', svg: svg('<path fill="currentColor" d="M2 9.2C2 8 3 7 4.2 7h5.2c1.2 0 2.2 1 2.2 2.2v4.6c0 1.2-1 2.2-2.2 2.2H4.2C3 16.2 2 15.2 2 14V9.2zm10.4 0c0-1.2 1-2.2 2.2-2.2h5.2c1.2 0 2.2 1 2.2 2.2V14c0 1.2-1 2.2-2.2 2.2h-5.2c-1.2 0-2.2-1-2.2-2.2V9.2z"/>') },
    jewelry: { color: '#F9AB00', svg: svg('<path fill="currentColor" d="m12 2 3.4 6.2 6.4.8-4.6 4.2 1.3 6.4L12 16.6 5.5 19.6 6.8 13.2 2.2 9l6.4-.8L12 2z"/>') },
    travel: { color: '#1A73E8', svg: svg('<path fill="currentColor" d="M22 12 2 5.6l2.8 4.6L13 12l-8.2 1.8L2 18.4 22 12z"/>') },
    info: { color: '#1A73E8', svg: svg('<path fill="currentColor" d="M10 3.4h4V8h-4V3.4zM10 9.6h4V21h-4V9.6z"/>') },
    service: { color: '#1A73E8', svg: svg('<path fill="currentColor" d="M12 2.4a4.2 4.2 0 0 1 4.2 4.2v1.2H18v12.6H6V7.8h1.8V6.6A4.2 4.2 0 0 1 12 2.4zM10 8h4V6.6a2 2 0 0 0-4 0V8z"/>') },
    elevator: { color: '#1565A8', svg: svg('<path fill="currentColor" d="M12 2 6.4 8.2h3.4v3.2h4.4V8.2H17.6L12 2zm0 20 5.6-6.2h-3.4v-3.2H9.8v3.2H6.4L12 22z"/>') },
    escalator: { color: '#1565A8', svg: svg('<path fill="currentColor" d="M3.5 16.2h5.2l6.6-8.4h5.2V5.2h-6.4L7.5 13.6H3.5v2.6z"/>') },
    stair: { color: '#1565A8', svg: svg('<path fill="currentColor" d="M2 20.5h6.2v-4.6h5.2v-4.6H19V6.6h3V4H16.2v4.6h-5.2v4.6H5.2v4.6H2v2.7z"/>') },
    see: { color: '#E8710A', svg: svg('<path fill="currentColor" d="M3 6.4h18v11.2H3V6.4zm2.2 2.2v6.8h13.6V8.6H5.2zM3 18.6h18V21H3v-2.4z"/>') },
    room: { color: '#5F6368', svg: svg('<path fill="currentColor" d="M5 3.5h8.2L19 9.2V21H5V3.5zM13 5.2V9h3.8L13 5.2zM10.4 12.2h3.2V19h-3.2v-6.8z"/>') },
    move: { color: '#1565A8', svg: svg('<path fill="currentColor" d="M12 2 6.2 8h3.6v8H6.2L12 22l5.8-6h-3.6V8h3.6L12 2z"/>') },
    pin: { color: '#1A73E8', svg: svg('<path fill="currentColor" d="M12 2a6.2 6.2 0 0 1 6.2 6.2c0 4.4-6.2 13.6-6.2 13.6S5.8 12.6 5.8 8.2A6.2 6.2 0 0 1 12 2zm0 3.2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>') }
  };

  function iconFor(properties, kind) {
    var category = properties.category || '';
    if (category === 'restroom') return 'rest';
    if (category === 'elevator') return 'elevator';
    if (category === 'escalator') return 'escalator';
    if (category === 'stair') return 'stair';
    if (category === 'parking') return 'park';
    var text = String(properties.name || '') + ' ' + String(properties.summary || '');
    for (var i = 0; i < ICON_RULES.length; i++) {
      if (ICON_RULES[i][1].test(text)) return ICON_RULES[i][0];
    }
    return KIND_ICON[kind] || 'pin';
  }

  function glyph(id) {
    return GLYPHS[id] || GLYPHS.pin;
  }

  function info(properties) {
    var p = properties || {};
    var guide = GUIDE[p.name] || {};
    var kind = p.kind || guide.kind || fromName(p.name);
    if (p.category === 'parking') kind = 'park';
    if (p.category === 'restroom') kind = 'rest';
    if (p.category === 'elevator' || p.category === 'escalator' || p.category === 'stair') kind = 'move';
    if (p.category === 'corridor') kind = 'move';
    var crowdKey = p.crowd || guide.crowd || (kind === 'move' || kind === 'room' || kind === 'rest' ? 'quiet' : 'steady');
    if (!CROWD[crowdKey]) crowdKey = 'steady';
    var offers = listOf(p.offers).length ? listOf(p.offers) : (guide.offers || []).slice();
    var about = p.about || guide.about || p.summary || '';
    return {
      kind: kind,
      kindLabel: KIND_LABEL[kind] || 'Place',
      icon: iconFor(p, kind),
      about: about,
      offers: offers,
      crowd: crowdKey,
      crowdLabel: CROWD[crowdKey].label,
      crowdLevel: CROWD[crowdKey].level
    };
  }

  root.IndoorPlaces = { KINDS: KINDS, info: info, glyph: glyph };
})(typeof globalThis !== 'undefined' ? globalThis : this);
