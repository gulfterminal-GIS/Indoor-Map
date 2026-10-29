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
      about: about,
      offers: offers,
      crowd: crowdKey,
      crowdLabel: CROWD[crowdKey].label,
      crowdLevel: CROWD[crowdKey].level
    };
  }

  root.IndoorPlaces = { KINDS: KINDS, info: info };
})(typeof globalThis !== 'undefined' ? globalThis : this);
