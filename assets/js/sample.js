/* Sample data: a clearly fictional Lahore wedding.
   Everything is generated relative to today so the countdown, the overdue list
   and the 30-day history always make sense whenever it is loaded. */
window.WCC = window.WCC || {};

(function (W) {
  'use strict';

  var U = W.Util;

  function build() {
    var today = U.todayISO();
    var d = function (offset) { return U.addDays(today, offset); };
    var stamp = function (offset, hh) { return d(offset) + 'T' + (hh || '10:30') + ':00.000'; };

    var events = [
      { id: 'evt_dholki', name: 'Dholki at the Chaudhry house', type: 'Dholki', date: d(108),
        startTime: '20:00', endTime: '23:30', venue: 'Chaudhry residence, Model Town',
        address: '14-C Block M, Model Town, Lahore', dressCode: 'Bright kurtas', theme: 'Yellow and orange',
        expectedGuests: 60, budget: 250000, status: 'Confirmed',
        notes: 'Dhol player booked for two hours. Cousins are practising the group dance.' },
      { id: 'evt_mayun', name: 'Mayun', type: 'Mayun', date: d(112),
        startTime: '17:00', endTime: '21:00', venue: 'Chaudhry residence, Model Town',
        address: '14-C Block M, Model Town, Lahore', dressCode: 'Yellow, no stitching', theme: 'Marigold courtyard',
        expectedGuests: 45, budget: 180000, status: 'Planning',
        notes: 'Ubtan ceremony folded into the same evening.' },
      { id: 'evt_mehndi', name: 'Mehndi', type: 'Mehndi', date: d(114),
        startTime: '19:00', endTime: '01:00', venue: 'Royal Palm Banquet Hall',
        address: 'Canal Bank Road, Lahore', dressCode: 'Green, yellow and gold', theme: 'Marigold and mirror work',
        expectedGuests: 320, budget: 1800000, status: 'Confirmed',
        notes: 'Two mehndi artists from 6pm. Stage on the lawn if the weather holds.' },
      { id: 'evt_nikah', name: 'Nikah and Baraat', type: 'Baraat', date: d(116),
        startTime: '18:30', endTime: '00:30', venue: 'Falettis Grand Marquee',
        address: 'Egerton Road, Lahore', dressCode: 'Formal — maroon and gold', theme: 'Maroon and gold',
        expectedGuests: 420, budget: 4500000, status: 'Confirmed',
        notes: 'Nikah at 7pm, dinner served from 9pm. Baraat leaves the house at 6pm.' },
      { id: 'evt_walima', name: 'Walima', type: 'Walima', date: d(118),
        startTime: '19:00', endTime: '23:30', venue: 'Pearl Continental, Grand Ballroom',
        address: 'Shahrah-e-Quaid-e-Azam, Lahore', dressCode: 'Formal', theme: 'Ivory and emerald',
        expectedGuests: 380, budget: 3800000, status: 'Planning',
        notes: 'Groom’s side hosting. Menu tasting still to be booked.' }
    ];

    var tasks = [
      /* --- done, spread across the last five weeks so the trend lines move --- */
      mk('Book the Baraat marquee', 'Venue', 'High', d(-38), -34),
      mk('Pay the marquee advance', 'Venue', 'High', d(-33), -31),
      mk('Shortlist three photographers', 'Photography', 'Medium', d(-32), -29),
      mk('Book the photographer', 'Photography', 'High', d(-27), -25),
      mk('Order the bridal jora from Rimsha Studio', 'Outfits', 'High', d(-30), -24),
      mk('Choose the jhumka and tikka set', 'Jewelry', 'High', d(-26), -21),
      mk('Draft the guest list with Ammi', 'Guest List', 'High', d(-24), -19),
      mk('Book the mehndi artists', 'Vendors', 'Medium', d(-20), -17),
      mk('Confirm the dholki date with the cousins', 'Family', 'Low', d(-18), -15),
      mk('Order the invitation cards', 'Invitations', 'High', d(-16), -12),
      mk('Book the beautician for all four functions', 'Hair & Makeup', 'High', d(-14), -10),
      mk('Taste the Walima menu options', 'Catering', 'Medium', d(-12), -8),
      mk('Order the groom’s sherwani and pagri', 'Outfits', 'Medium', d(-10), -6),
      mk('Arrange the stage flowers for the Mehndi', 'Decor & Flowers', 'Medium', d(-8), -4),
      mk('Confirm the dhol players', 'Music & Entertainment', 'Low', d(-6), -3),
      mk('Send invitations to the Karachi relatives', 'Invitations', 'High', d(-5), -2),
      mk('Book the bridal car', 'Transport', 'Medium', d(-4), -1),

      /* --- overdue --- */
      mk('Collect the khussa order from Anarkali', 'Shopping', 'Medium', d(-6), null, 'In Progress'),
      mk('Confirm the Walima headcount with the hotel', 'Catering', 'High', d(-2), null, 'In Progress'),

      /* --- due today --- */
      mk('Call the decorator about the Mehndi lighting', 'Decor & Flowers', 'High', today, null, 'Not Started'),
      mk('Send the Nikah timings to the qazi', 'Nikah & Legal', 'High', today, null, 'Not Started'),

      /* --- this week and beyond --- */
      mk('Book the mithai order for the Baraat', 'Catering', 'Medium', d(2), null, 'Not Started'),
      mk('First fitting for the bridal jora', 'Outfits', 'High', d(4), null, 'Not Started'),
      mk('Finalise the seating plan for the Walima', 'Guest List', 'Medium', d(9), null, 'Not Started'),
      mk('Arrange guest rooms for the Islamabad family', 'Family', 'Medium', d(16), null, 'Not Started'),
      mk('Book the honeymoon flights to Hunza', 'Honeymoon', 'Low', d(30), null, 'Not Started'),
      mk('Pay the caterer’s second instalment', 'Catering', 'High', d(45), null, 'Not Started'),
      mk('Collect the jewelry from the vault', 'Jewelry', 'High', d(112), null, 'Not Started')
    ];

    function mk(title, category, priority, dueDate, doneOffset, status) {
      var createdOffset = Math.min(-40, U.daysBetween(today, dueDate) - 20);
      var task = {
        id: U.uid('task'),
        title: title,
        category: category,
        priority: priority,
        status: status || 'Not Started',
        dueDate: dueDate,
        notes: '',
        recurrence: 'none',
        completedAt: null,
        completedDates: [],
        createdAt: d(createdOffset) + 'T09:00:00.000'
      };
      if (doneOffset !== null && doneOffset !== undefined) {
        task.completedAt = stamp(doneOffset);
        task.completedDates = [d(doneOffset)];
        task.status = 'Completed';
      }
      return task;
    }

    /* --- recurring: completion is a set of dates, so a streak survives --- */
    var dailyDefs = [
      { title: 'Ring one vendor and follow up', category: 'Vendors', priority: 'High', skip: [] },
      { title: 'Update the guest list with today’s replies', category: 'Guest List', priority: 'Medium', skip: [11, 12] },
      { title: 'Log yesterday’s spending in the budget', category: 'Other', priority: 'Medium', skip: [11, 19, 20] }
    ];
    dailyDefs.forEach(function (def) {
      var dates = [];
      for (var i = 29; i >= 1; i--) {
        if (def.skip.indexOf(i) >= 0) continue;
        dates.push(d(-i));
      }
      tasks.push({
        id: U.uid('task'),
        title: def.title,
        category: def.category,
        priority: def.priority,
        status: 'In Progress',
        dueDate: '',
        notes: '',
        recurrence: 'daily',
        completedAt: dates.length ? dates[dates.length - 1] + 'T09:00:00.000' : null,
        completedDates: dates,
        createdAt: d(-35) + 'T09:00:00.000'
      });
    });

    tasks.push({
      id: U.uid('task'),
      title: 'Weekly check-in with Ammi and the phupho',
      category: 'Family',
      priority: 'Medium',
      status: 'In Progress',
      dueDate: today,
      notes: 'Run through the week’s decisions together.',
      recurrence: 'weekly',
      completedAt: d(-7) + 'T09:00:00.000',
      completedDates: [d(-28), d(-21), d(-14), d(-7)],
      createdAt: d(-35) + 'T09:00:00.000'
    });

    /* --- budget: PKR, two categories deliberately over --- */
    var budget = [
      bud('Venue', 2500000, 2500000, 'Paid', 'Falettis Grand Marquee', -31),
      bud('Catering', 3200000, 1600000, 'Partially Paid', 'Salt’n Pepper Catering', -22),
      bud('Photography', 650000, 325000, 'Partially Paid', 'Rukhsar Films', -25),
      bud('Videography', 350000, 0, 'Unpaid', 'Rukhsar Films', null),
      bud('Bridal Outfits', 900000, 985000, 'Partially Paid', 'Rimsha Studio', -18),
      bud('Groom Outfits', 300000, 265000, 'Paid', 'Amir Adnan', -6),
      bud('Jewelry', 1800000, 1750000, 'Paid', 'Hafeez Jewellers', -21),
      bud('Hair & Makeup', 250000, 125000, 'Partially Paid', 'Nabila’s Salon', -10),
      bud('Decor & Flowers', 800000, 300000, 'Partially Paid', 'Gulzar Decorators', -4),
      bud('Mehndi Artist', 120000, 60000, 'Partially Paid', 'Henna by Areeba', -17),
      bud('Music & DJ', 250000, 0, 'Unpaid', '', null),
      bud('Invitations', 180000, 195000, 'Paid', 'Kaghaz Card House', -12),
      bud('Transport', 220000, 0, 'Unpaid', '', null),
      bud('Guest Accommodation', 400000, 0, 'Unpaid', '', null),
      bud('Gifts & Favours', 350000, 90000, 'Partially Paid', 'Daaman Gifts', -9),
      bud('Sweets & Mithai', 180000, 45000, 'Partially Paid', 'Rehmat-e-Shereen', -3),
      bud('Stage & Lighting', 450000, 0, 'Unpaid', 'Gulzar Decorators', null),
      bud('Nikah & Documentation', 60000, 15000, 'Partially Paid', '', -2),
      bud('Miscellaneous', 200000, 35000, 'Partially Paid', '', -1)
    ];

    function bud(category, planned, actual, paymentStatus, vendor, payOffset) {
      return {
        id: U.uid('bud'),
        category: category,
        label: '',
        planned: planned,
        actual: actual,
        paymentStatus: paymentStatus,
        vendor: vendor,
        paymentDate: payOffset === null ? '' : d(payOffset),
        notes: ''
      };
    }

    /* --- vendors: each one links to a budget line, never its own ledger --- */
    function lineFor(category) {
      for (var i = 0; i < budget.length; i++) {
        if (budget[i].category === category) return budget[i].id;
      }
      return '';
    }

    var vendors = [
      vnd('Falettis Grand Marquee', 'Venue', 'Mr. Kamran', '042 36363636',
        'events@falettis.example', 'falettis.example', 2600000, 2500000, 'Booked', 'evt_nikah',
        'Marquee, tables and chairs included. Generator on standby.'),
      vnd('Salt\u2019n Pepper Catering', 'Catering', 'Mr. Shahid', '0300 8877665',
        'orders@saltnpepper.example', '@saltnpepper.events', 3400000, 3200000, 'Booked', '',
        'Second instalment due six weeks before the Baraat.'),
      vnd('Rukhsar Films', 'Photography', 'Bilal Rukhsar', '0321 4455667',
        'hello@rukhsarfilms.example', '@rukhsarfilms', 700000, 650000, 'Booked', '',
        'Two photographers across all four functions.'),
      vnd('Rukhsar Films (video)', 'Videography', 'Bilal Rukhsar', '0321 4455667',
        'hello@rukhsarfilms.example', '@rukhsarfilms', 380000, 350000, 'Quoted', '',
        'Same team, separate quote for the cinematic film.'),
      vnd('Nabila\u2019s Salon', 'Hair & Makeup', 'Front desk', '042 35777888',
        'bookings@nabila.example', '@nabilasalon', 260000, 250000, 'Booked', '',
        'Bridal makeup for all four functions, plus two family members.'),
      vnd('Gulzar Decorators', 'Decor & Flowers', 'Gulzar Sahib', '0333 2211445',
        '', '@gulzardecor', 850000, 800000, 'Booked', 'evt_mehndi',
        'Marigold and mirror work for the Mehndi stage.'),
      vnd('Henna by Areeba', 'Mehndi Artist', 'Areeba', '0345 9988771',
        '', '@hennabyareeba', 120000, 120000, 'Booked', 'evt_mehndi',
        'Two artists from 6pm.'),
      vnd('Beat Box DJ', 'Music & DJ', 'Danish', '0321 7766554',
        'book@beatbox.example', '@beatboxlhr', 280000, 0, 'Quoted', 'evt_mehndi',
        'Waiting on the revised quote with the extra hour.'),
      vnd('Shahi Transport', 'Transport', 'Iqbal', '0300 7788990',
        '', '', 240000, 0, 'Contacted', 'evt_nikah',
        'Bridal car plus two coasters for the Islamabad family.'),
      vnd('Kaghaz Card House', 'Invitations', 'Mr. Naveed', '042 37220011',
        '', '@kaghazcards', 180000, 195000, 'Booked', '',
        'Gold foil went over the original quote.'),
      vnd('Mehfil Lights', 'Stage & Lighting', '', '0301 5544332',
        '', '@mehfillights', 0, 0, 'Researching', '',
        'Found on Instagram, not called yet.'),
      vnd('Rehmat-e-Shereen', 'Sweets & Mithai', 'Counter', '042 35844333',
        '', '', 200000, 0, 'Contacted', 'evt_nikah',
        'Mithai boxes for the Baraat guests.')
    ];

    function vnd(name, category, contactName, phone, email, website, quoted, final, status, eventId, notes) {
      /* Everything except the vendors still being researched is tied to the
         budget line that holds its payments. */
      var link = status === 'Researching' ? '' : lineFor(category);
      return {
        id: U.uid('vnd'),
        name: name, category: category, contactName: contactName,
        phone: phone, email: email, website: website,
        quotedPrice: quoted, finalPrice: final, status: status,
        eventId: eventId, budgetLineId: link, notes: notes
      };
    }

    /* Day-of arrival times, used by the wedding-day sheet. */
    var ARRIVALS = {
      'Nabila\u2019s Salon': '14:00',
      'Rukhsar Films': '16:00',
      'Gulzar Decorators': '12:00',
      'Salt\u2019n Pepper Catering': '17:00',
      'Falettis Grand Marquee': '10:00',
      'Henna by Areeba': '18:00'
    };
    vendors.forEach(function (v) { v.arrivalTime = ARRIVALS[v.name] || ''; });

    /* --- clothing and jewelry: one list, with a person field --- */
    var wardrobe = [
      wrd('Bride', '', 'Outfit', 'Bridal jora, red and gold', 'Rimsha Studio', 985000, 'At Tailor', 4, 'evt_nikah', 'Sleeves being taken in.'),
      wrd('Bride', '', 'Outfit', 'Mehndi lehnga, yellow', 'Zainab Chottani', 320000, 'Received', null, 'evt_mehndi', ''),
      wrd('Bride', '', 'Outfit', 'Walima sari, ivory', 'Faraz Manan', 280000, 'Ordered', 26, 'evt_walima', 'Ready for collection in three weeks.'),
      wrd('Bride', '', 'Jewelry', 'Jhumka and tikka set', 'Hafeez Jewellers', 1750000, 'Ready', null, 'evt_nikah', 'In the bank vault until the week of.'),
      wrd('Bride', '', 'Shoes', 'Khussa, gold thread', 'Anarkali Bazaar', 18000, 'To Buy', null, 'evt_mehndi', ''),
      wrd('Bride', '', 'Dupatta', 'Mirror-work dupatta', 'Liberty Market', 25000, 'Received', null, 'evt_mayun', ''),
      wrd('Groom', '', 'Outfit', 'Sherwani and pagri', 'Amir Adnan', 265000, 'Alterations', 6, 'evt_nikah', 'Pagri tying booked for the morning.'),
      wrd('Groom', '', 'Outfit', 'Walima suit, navy', 'Republic', 95000, 'Ordered', 20, 'evt_walima', ''),
      wrd('Groom', '', 'Outfit', 'Kurta for the Mehndi', 'J.', 22000, 'Received', null, 'evt_mehndi', ''),
      wrd('Family', 'Ammi', 'Outfit', 'Walima sari, emerald', 'Sana Safinaz', 85000, 'To Buy', null, 'evt_walima', ''),
      wrd('Family', 'Hira', 'Outfit', 'Mehndi lehnga, orange', 'Maria B', 140000, 'Ordered', 12, 'evt_mehndi', 'Bride\u2019s sister.')
    ];

    function wrd(person, wearer, kind, outfit, designer, cost, status, fitOffset, eventId, notes) {
      return {
        id: U.uid('wrd'),
        person: person, wearer: wearer, kind: kind, outfit: outfit,
        designer: designer, cost: cost, status: status,
        fittingDate: fitOffset === null ? '' : d(fitOffset),
        eventId: eventId, notes: notes
      };
    }

    /* --- catering: menu by course, priced per head --- */
    var menu = [
      dish('evt_mehndi', 'Welcome drinks', 'Kashmiri chai and lemonade', 180),
      dish('evt_mehndi', 'Starters', 'Chicken malai boti', 420),
      dish('evt_mehndi', 'Main course', 'Nihari with naan', 650),
      dish('evt_mehndi', 'Rice & breads', 'Chicken biryani', 520),
      dish('evt_mehndi', 'Desserts', 'Kheer', 220),
      dish('evt_nikah', 'Starters', 'Seekh kebab and chapli kebab', 480),
      dish('evt_nikah', 'BBQ', 'Mutton chops', 900),
      dish('evt_nikah', 'Main course', 'Mutton karahi', 1150),
      dish('evt_nikah', 'Rice & breads', 'Mutton pulao and roghni naan', 780),
      dish('evt_nikah', 'Desserts', 'Gulab jamun and shahi tukda', 240),
      dish('evt_nikah', 'Mithai', 'Mithai boxes for guests', 350),
      dish('evt_walima', 'Starters', 'Prawn tempura', 620),
      dish('evt_walima', 'Main course', 'Chicken handi', 850),
      dish('evt_walima', 'Rice & breads', 'Kabuli pulao', 700),
      dish('evt_walima', 'Desserts', 'Firni and ice cream', 300),
      dish('', 'Tea & coffee', 'Chai station', 120)
    ];

    function dish(eventId, course, name, costPerHead) {
      return {
        id: U.uid('menu'), course: course, name: name,
        costPerHead: costPerHead, eventId: eventId, notes: ''
      };
    }

    /* --- shopping list --- */
    var shopping = [
      shop('Khussa for the bride', 'Shoes & khussa', 1, 18000, 'To Buy', 'Sarah', null),
      shop('Mithai boxes for the Baraat guests', 'Mithai & sweets', 200, 350, 'Ordered', 'Ammi', null),
      shop('Gifts for the in-laws', 'Gifts & favours', 12, 8000, 'To Buy', 'Ammi', null),
      shop('Mehndi thaals', 'Decor', 6, 4500, 'Bought', 'Hira', -9),
      shop('Churiyan for the Mayun', 'Jewelry', 3, 6000, 'To Buy', 'Sarah', null),
      shop('Guest favour pouches', 'Gifts & favours', 400, 250, 'To Buy', 'Ahmed', null),
      shop('Bridal hair accessories', 'Beauty', 1, 12000, 'Ordered', 'Sarah', null),
      shop('Salami envelopes', 'Stationery', 100, 60, 'Bought', 'Ammi', -4),
      shop('Dholki decorations', 'Decor', 1, 15000, 'Bought', 'Hira', -12),
      shop('Marigold garlands', 'Decor', 40, 900, 'To Buy', 'Ahmed', null)
    ];

    function shop(item, category, quantity, cost, status, who, boughtOffset) {
      return {
        id: U.uid('shop'), item: item, category: category, quantity: quantity,
        estimatedCost: cost, status: status, assignedTo: who,
        purchaseDate: boughtOffset === null ? '' : d(boughtOffset), notes: ''
      };
    }

    /* --- contacts --- */
    var contacts = [
      con('Rukhsana Siddiqui', 'Family', 'Bride\u2019s mother', '0300 1123344', ''),
      con('Hira Siddiqui', 'Family', 'Bride\u2019s sister', '0345 6677889', ''),
      con('Maulana Abdul Rehman', 'Religious', 'Qazi for the Nikah', '0333 5566778', ''),
      con('Mr. Kamran', 'Venue', 'Falettis events desk', '042 36363636', 'events@falettis.example'),
      con('Bilal Rukhsar', 'Vendor', 'Photographer', '0321 4455667', 'hello@rukhsarfilms.example'),
      con('Iqbal', 'Transport', 'Bridal car and coasters', '0300 7788990', ''),
      con('Shaista Anwar', 'Family', 'Phupho, knows everyone', '0301 4478899', ''),
      con('Danish', 'Vendor', 'DJ for the Mehndi', '0321 7766554', 'book@beatbox.example')
    ];

    function con(name, role, relation, phone, email) {
      return {
        id: U.uid('con'), name: name, role: role, relation: relation,
        phone: phone, email: email, notes: ''
      };
    }

    /* --- guests --- */
    var allEvents = events.map(function (e) { return e.id; });
    var big = ['evt_mehndi', 'evt_nikah', 'evt_walima'];
    var close = ['evt_dholki', 'evt_mayun', 'evt_mehndi', 'evt_nikah', 'evt_walima'];

    var guests = [
      g('Fatima Siddiqui', 'Siddiqui family', 'Bride', '0300 4412876', 4, 2, 'Attending', 'Delivered', close, 'No preference', 'Ammi’s closest cousin — helping with the mayun.'),
      g('Bilal and Ayesha Chaudhry', 'Chaudhry family', 'Both', '0321 8890123', 2, 1, 'Attending', 'Delivered', close, 'No beef', ''),
      g('Nadia Aunty', 'Gulberg neighbours', 'Bride', '0333 2214567', 2, 0, 'Attending', 'Sent', big, 'Diabetic', ''),
      g('Hassan Malik family', 'Malik family', 'Groom', '0345 7761234', 5, 3, 'Attending', 'Delivered', big, 'No preference', 'Driving from Islamabad — need two guest rooms.'),
      g('Zainab Qureshi', 'College friends', 'Bride', '0301 9987654', 1, 0, 'Attending', 'Sent', big, 'Vegetarian', ''),
      g('Imran Sheikh', 'Office colleagues', 'Groom', '0334 4432211', 2, 0, 'Pending', 'Sent', ['evt_nikah', 'evt_walima'], 'No preference', ''),
      g('Rukhsana Begum', 'Siddiqui family', 'Bride', '0300 1123344', 1, 0, 'Attending', 'Delivered', close, 'Diabetic', 'Nani — seat near the stage.'),
      g('Tariq and Saima Butt', 'Butt family', 'Groom', '0322 5567788', 2, 2, 'Maybe', 'Sent', big, 'No preference', 'Waiting on their Dubai flights.'),
      g('Dr. Aliya Rehman', 'Family friends', 'Both', '0345 2298761', 2, 1, 'Attending', 'Delivered', big, 'No beef', ''),
      g('Usman Farooq', 'College friends', 'Groom', '0311 8845673', 1, 0, 'Not Attending', 'Delivered', big, 'No preference', 'Posted abroad until December.'),
      g('Mehreen Javed', 'College friends', 'Bride', '0332 7712398', 2, 0, 'Attending', 'Sent', big, 'Vegetarian', ''),
      g('Khalid Mahmood family', 'Mahmood family', 'Groom', '0300 6654321', 4, 2, 'Pending', 'Sent', big, 'No preference', ''),
      g('Sana Iqbal', 'Gulberg neighbours', 'Bride', '0321 3345566', 1, 1, 'Pending', 'Not Sent', ['evt_mehndi'], 'Child meal', ''),
      g('Adeel Raza', 'Office colleagues', 'Groom', '0333 9987123', 2, 0, 'Maybe', 'Sent', ['evt_walima'], 'No preference', ''),
      g('Shaista Anwar', 'Anwar family', 'Bride', '0301 4478899', 3, 1, 'Attending', 'Delivered', close, 'No preference', 'Bringing the mithai for the dholki.'),
      g('Junaid and Hira Ansari', 'Family friends', 'Both', '0345 1122334', 2, 2, 'Attending', 'Delivered', big, 'No beef', ''),
      g('Parveen Khala', 'Siddiqui family', 'Bride', '0300 3312876', 2, 0, 'Attending', 'Delivered', close, 'Diabetic', ''),
      g('Faisal Nawaz', 'Office colleagues', 'Groom', '0322 6678890', 1, 0, 'Pending', 'Not Sent', ['evt_walima'], 'No preference', '')
    ];

    function g(name, group, side, phone, adults, children, rsvp, invitation, evts, meal, notes) {
      return {
        id: U.uid('guest'),
        name: name, group: group, side: side, phone: phone,
        adults: adults, children: children, rsvp: rsvp, invitation: invitation,
        events: evts === allEvents ? allEvents.slice() : evts.slice(),
        meal: meal, notes: notes
      };
    }

    /* --- seating: one table deliberately over capacity to show the warning --- */
    var tables = [
      tbl('Table 1 — Siddiqui family', 10, 'evt_nikah', [guests[0].id, guests[1].id], ''),
      tbl('Table 2 — Malik family', 8, 'evt_nikah', [guests[3].id], 'Driving from Islamabad.'),
      tbl('Table 3 — Neighbours and cousins', 6, 'evt_nikah',
        [guests[2].id, guests[6].id, guests[14].id], 'Needs another chair or two.'),
      tbl('Table 4 — College friends', 10, 'evt_nikah', [], ''),
      tbl('Top table', 8, 'evt_walima', [guests[0].id, guests[3].id], 'Both sets of parents.'),
      tbl('Table A', 10, 'evt_walima', [], '')
    ];

    function tbl(name, capacity, eventId, guestIds, notes) {
      return {
        id: U.uid('tbl'), name: name, capacity: capacity, eventId: eventId,
        guestIds: guestIds, notes: notes
      };
    }

    /* --- decor and theme --- */
    var decor = [
      dec('Stage', 'evt_mehndi', 'Marigold arch with mirror-work panels behind the sofa',
        'Marigold, ivory, mirror', 'Ordered', 'Gulzar Decorators', 320000,
        'Two-metre arch. Confirm the height with the hall.'),
      dec('Entrance', 'evt_mehndi', 'Marigold garlands over the doorway and a dhol platform',
        'Marigold, green', 'Agreed', 'Gulzar Decorators', 60000, ''),
      dec('Tables', 'evt_walima', 'Ivory linen, low emerald centrepieces, gold chargers',
        'Ivory, emerald, gold', 'Idea', '', 180000, 'Ask the hotel what linen they include.'),
      dec('Ceiling and drapes', 'evt_nikah', 'Maroon and gold drapes with warm fairy lights',
        'Maroon, gold', 'Ordered', 'Gulzar Decorators', 240000, ''),
      dec('Lighting', 'evt_nikah', 'Warm uplighters around the marquee, spotlights on the stage',
        'Warm white', 'Idea', 'Mehfil Lights', 150000, 'Still to call Mehfil Lights.'),
      dec('Bridal car', 'evt_nikah', 'White roses and ribbon on the bonnet',
        'White, gold', 'Agreed', 'Gulzar Decorators', 25000, ''),
      dec('Photo booth', 'evt_mehndi', 'Marigold backdrop with the hashtag board',
        'Marigold, yellow', 'Done', '', 45000, 'Board collected from the printers.')
    ];

    function dec(area, eventId, description, palette, status, supplier, cost, notes) {
      return {
        id: U.uid('dec'), area: area, eventId: eventId, description: description,
        palette: palette, status: status, supplier: supplier,
        estimatedCost: cost, notes: notes
      };
    }

    /* --- photo shot list --- */
    var shots = [
      shot('Bride', 'evt_nikah', 'Jora detail — dupatta, jhumka and khussa laid out', 'Sarah', true, true, ''),
      shot('Bride', 'evt_nikah', 'Sarah with her mother before the Baraat arrives', 'Sarah, Ammi', true, false, ''),
      shot('Groom', 'evt_nikah', 'Pagri being tied', 'Ahmed, Abbu', true, false, ''),
      shot('Couple', 'evt_nikah', 'First look on the stage', 'Sarah, Ahmed', true, false, ''),
      shot('Couple', 'evt_walima', 'Portraits in the hotel garden at golden hour', 'Sarah, Ahmed', true, false, ''),
      shot('Family', 'evt_nikah', 'Full group with both families on the stage', 'Everyone', true, false,
        'Do this before dinner, while people are still in one place.'),
      shot('Family', 'evt_nikah', 'Sarah with Rukhsana Begum (Nani)', 'Sarah, Rukhsana Begum', true, false,
        'Nani tires early — do this first.'),
      shot('Group', 'evt_mehndi', 'Cousins after the group dance', 'The cousins', false, true, ''),
      shot('Details', 'evt_mehndi', 'Mehndi on the hands, close up', 'Sarah', true, false, ''),
      shot('Details', 'evt_nikah', 'The Nikah nama being signed', '', false, false, ''),
      shot('Candid', 'evt_mehndi', 'Dhol players and the crowd', '', false, true, ''),
      shot('Venue', 'evt_walima', 'Empty ballroom before the guests arrive', '', false, false, '')
    ];

    function shot(category, eventId, description, people, mustHave, done, notes) {
      return {
        id: U.uid('shot'), category: category, eventId: eventId, description: description,
        people: people, mustHave: mustHave, done: done, notes: notes
      };
    }

    /* --- Nikah checklist: questions to ask, never statements of the law --- */
    var nikah = [
      nik('Ask the Nikah registrar what they need from us, and by when', 'In Progress', 'Abbu', -1,
        'Ringing him again this week.'),
      nik('Confirm the date and time with the qazi', 'Done', 'Abbu', -8, 'Confirmed for 7pm.'),
      nik('Agree the mehr between both families, and ask the registrar how he records it',
        'In Progress', 'Both families', 20, ''),
      nik('Ask the registrar what his fee is and how he would like it paid', 'To Do', 'Ahmed', 30, ''),
      nik('Decide who the witnesses will be, and ask the registrar what he needs from them',
        'To Do', 'Abbu', 40, ''),
      nik('Ask whether anything needs arranging before the day itself', 'To Do', 'Ammi', 45, ''),
      nik('Ask how and when we get the paperwork afterwards', 'To Do', 'Ahmed', 100, ''),
      nik('Book a quiet room at the venue for the Nikah', 'Done', 'Ammi', -4, 'The side hall is ours from 6pm.')
    ];

    function nik(item, status, owner, dueOffset, notes) {
      return {
        id: U.uid('nik'), item: item, status: status, owner: owner,
        dueDate: dueOffset === null ? '' : d(dueOffset), notes: notes
      };
    }

    /* --- honeymoon --- */
    var honeymoon = {
      destination: 'Hunza and Skardu',
      startDate: d(121),
      endDate: d(130),
      budget: 850000,
      notes: 'Nine nights up north, back in time for Ahmed\u2019s office.',
      items: [
        hmi('Flight', 'Flights to Gilgit', 121, 180000, 'Booked', 'PK-8842', ''),
        hmi('Hotel', 'Serena Hunza, four nights', 121, 320000, 'Booked', 'SH-99213', ''),
        hmi('Transfer', 'Jeep to Skardu', 125, 60000, 'To Book', '', 'Ask the hotel to arrange it.'),
        hmi('Hotel', 'Shangrila Resort, three nights', 125, 210000, 'To Book', '', ''),
        hmi('Activity', 'Deosai day trip', 127, 45000, 'To Book', '', ''),
        hmi('Insurance', 'Travel insurance for both', 118, 18000, 'To Book', '', ''),
        hmi('Packing', 'Warm clothes — it will be cold at night', null, 0, 'To Book', '', '')
      ]
    };

    function hmi(type, title, dateOffset, cost, status, reference, notes) {
      return {
        id: U.uid('hmi'), type: type, title: title,
        date: dateOffset === null ? '' : d(dateOffset), cost: cost,
        status: status, reference: reference, notes: notes
      };
    }

    /* --- gifts and salami --- */
    var gifts = [
      gift(guests[0].id, 'Cash (salami)', '', 50000, 'evt_dholki', -3, true, ''),
      gift(guests[6].id, 'Cash (salami)', '', 25000, 'evt_dholki', -3, true, ''),
      gift(guests[16].id, 'Jewelry', 'Gold bangles for the bride', 120000, '', -2, false, ''),
      gift(guests[1].id, 'Gift', 'Dinner set, twelve pieces', 35000, '', -2, false, ''),
      gift(guests[8].id, 'Cash (salami)', '', 30000, 'evt_dholki', -1, false, ''),
      gift('', 'Gift', 'Prayer mat and tasbih from the neighbours', 8000, '', -1, false,
        'Left at the house, no note.'),
      gift(guests[14].id, 'Voucher', 'Home store voucher', 20000, '', 0, false, '')
    ];

    function gift(guestId, kind, description, amount, eventId, dateOffset, thanked, notes) {
      return {
        id: U.uid('gift'), guestId: guestId,
        from: guestId ? '' : 'The Rehmans next door',
        kind: kind, description: description, amount: amount, eventId: eventId,
        date: d(dateOffset), thankYouSent: thanked, notes: notes
      };
    }
    gifts.forEach(function (gf) {
      if (gf.guestId) {
        for (var i = 0; i < guests.length; i++) {
          if (guests[i].id === gf.guestId) { gf.from = guests[i].name; break; }
        }
      }
    });

    /* --- who does what --- */
    var responsibilities = [
      resp('Hira Siddiqui', 'Guest welcome', 'evt_nikah',
        'Meets guests at the gate and points them to the hall', 'Accepted', ''),
      resp('Rukhsana Siddiqui', 'Elders and children', 'evt_nikah',
        'Seats the elders early and keeps an eye on the children', 'Accepted', ''),
      resp('Shaista Anwar', 'Mithai and favours', 'evt_nikah',
        'Hands out the mithai boxes as guests leave', 'Assigned', ''),
      resp('Iqbal', 'Car and transport', 'evt_nikah',
        'Bridal car and the two coasters from the hotel', 'Accepted', ''),
      resp('Bilal Rukhsar', 'Photography liaison', 'evt_nikah',
        'Runs the shot list with the photographers', 'Assigned', ''),
      resp('Ahmed', 'Vendor liaison', 'evt_mehndi',
        'First call for anything that goes wrong on the night', 'Accepted', ''),
      resp('Abbu', 'Nikah paperwork', 'evt_nikah',
        'Looks after the registrar and the witnesses', 'Assigned', ''),
      resp('Danish', 'Music and dhol', 'evt_mehndi',
        'Cues the dhol for the entrance and the group dance', 'Done', '')
    ];

    function resp(person, area, eventId, description, status, notes) {
      return {
        id: U.uid('resp'), person: person, area: area, eventId: eventId,
        description: description, status: status, notes: notes
      };
    }

    /* --- the running order for the Baraat --- */
    var timeline = [
      slot('evt_nikah', '14:00', 'Beautician arrives at the house', 'Sarah', ''),
      slot('evt_nikah', '16:00', 'Photographers start the getting-ready shots', 'Hira Siddiqui', ''),
      slot('evt_nikah', '17:30', 'Groom\u2019s side gathers for the Baraat', 'Ahmed', ''),
      slot('evt_nikah', '18:00', 'Baraat leaves the house', 'Iqbal', 'Two coasters and the bridal car.'),
      slot('evt_nikah', '18:45', 'Baraat arrives at Falettis', '', ''),
      slot('evt_nikah', '19:00', 'Nikah', 'Abbu', 'Side hall. Witnesses to be there by 6:45.'),
      slot('evt_nikah', '19:45', 'Stage photos with both families', 'Bilal Rukhsar', ''),
      slot('evt_nikah', '21:00', 'Dinner served', 'Mr. Shahid', ''),
      slot('evt_nikah', '23:00', 'Rukhsati', 'Rukhsana Siddiqui', ''),
      slot('evt_nikah', '00:30', 'Vendors clear the hall', '', ''),
      slot('evt_mehndi', '18:00', 'Mehndi artists set up', '', ''),
      slot('evt_mehndi', '19:00', 'Guests arrive, dhol at the entrance', 'Danish', ''),
      slot('evt_mehndi', '20:30', 'Group dances', 'Hira Siddiqui', ''),
      slot('evt_mehndi', '22:00', 'Dinner', '', '')
    ];

    function slot(eventId, time, title, owner, notes) {
      return {
        id: U.uid('slot'), eventId: eventId, time: time, title: title,
        owner: owner, done: false, notes: notes
      };
    }

    /* --- history: derived from the data above so the trends are honest --- */
    var oneOff = tasks.filter(function (t) { return t.recurrence === 'none'; });
    var history = [];
    for (var i = 30; i >= 1; i--) {
      var day = d(-i);
      var created = oneOff.filter(function (t) { return String(t.createdAt).slice(0, 10) <= day; });
      var done = created.filter(function (t) { return t.completedAt && String(t.completedAt).slice(0, 10) <= day; });
      var spent = 0;
      budget.forEach(function (b) {
        if (b.paymentDate && b.paymentDate <= day) spent += b.actual;
      });
      var ramp = (30 - i) / 30;
      var guestsTotal = Math.max(6, Math.round(guests.length * (0.45 + 0.55 * ramp)));
      var attending = guests.filter(function (x) { return x.rsvp === 'Attending'; }).length;
      history.push({
        date: day,
        tasksTotal: created.length,
        tasksDone: done.length,
        budgetPlanned: budget.reduce(function (s, b) { return s + b.planned; }, 0),
        budgetSpent: spent,
        guestsTotal: guestsTotal,
        guestsConfirmed: Math.round(attending * (0.3 + 0.7 * ramp)),
        vendorsBooked: Math.min(7, Math.round(2 + 5 * ramp))
      });
    }

    return {
      schema: 1,
      settings: {
        brideName: 'Sarah',
        groomName: 'Ahmed',
        weddingDate: d(116),
        venue: 'Falettis Grand Marquee, Lahore',
        hashtag: '#SarahFoundHerAhmed',
        currency: 'PKR'
      },
      events: events,
      tasks: tasks,
      budget: budget,
      guests: guests,
      vendors: vendors,
      wardrobe: wardrobe,
      catering: { guestCount: 380, items: menu },
      shopping: shopping,
      contacts: contacts,
      tables: tables,
      decor: decor,
      shots: shots,
      nikah: nikah,
      honeymoon: honeymoon,
      gifts: gifts,
      responsibilities: responsibilities,
      timeline: timeline,
      history: history,
      meta: { createdAt: d(-40) + 'T09:00:00.000', onboarded: true, seeded: true, savedAt: '' }
    };
  }

  W.Sample = { build: build };
})(window.WCC);
