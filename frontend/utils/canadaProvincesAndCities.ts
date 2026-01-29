export const CANADA_PROVINCES_AND_CITIES: { [key: string]: string[] } = {
  'Alberta': ['Calgary', 'Edmonton', 'Red Deer', 'Lethbridge', 'St. Albert', 'Medicine Hat', 'Grande Prairie', 'Airdrie', 'Spruce Grove', 'Leduc'],
  'British Columbia': ['Vancouver', 'Victoria', 'Surrey', 'Burnaby', 'Richmond', 'Kelowna', 'Kamloops', 'Nanaimo', 'Abbotsford', 'Coquitlam'],
  'Manitoba': ['Winnipeg', 'Brandon', 'Steinbach', 'Thompson', 'Portage la Prairie', 'Selkirk', 'Winkler', 'Morden', 'Dauphin', 'The Pas'],
  'New Brunswick': ['Saint John', 'Moncton', 'Fredericton', 'Dieppe', 'Riverview', 'Miramichi', 'Edmundston', 'Bathurst', 'Campbellton', 'Oromocto'],
  'Newfoundland and Labrador': ['St. John\'s', 'Mount Pearl', 'Corner Brook', 'Conception Bay South', 'Paradise', 'Grand Falls-Windsor', 'Gander', 'Happy Valley-Goose Bay', 'Labrador City', 'Stephenville'],
  'Northwest Territories': ['Yellowknife', 'Hay River', 'Inuvik', 'Fort Smith', 'Behchoko', 'Fort Simpson', 'Norman Wells', 'Tuktoyaktuk', 'Fort Resolution', 'Fort Providence'],
  'Nova Scotia': ['Halifax', 'Dartmouth', 'Sydney', 'Truro', 'New Glasgow', 'Glace Bay', 'Kentville', 'Amherst', 'Bridgewater', 'Yarmouth'],
  'Nunavut': ['Iqaluit', 'Rankin Inlet', 'Arviat', 'Baker Lake', 'Cambridge Bay', 'Igloolik', 'Pond Inlet', 'Kugluktuk', 'Pangnirtung', 'Cape Dorset'],
  'Ontario': ['Toronto', 'Ottawa', 'Mississauga', 'Brampton', 'Hamilton', 'London', 'Markham', 'Vaughan', 'Kitchener', 'Windsor', 'Richmond Hill', 'Oakville', 'Burlington', 'Waterloo', 'Guelph'],
  'Prince Edward Island': ['Charlottetown', 'Summerside', 'Stratford', 'Cornwall', 'Montague', 'Kensington', 'Souris', 'Alberton', 'Tignish', 'Georgetown'],
  'Quebec': ['Montreal', 'Quebec City', 'Laval', 'Gatineau', 'Longueuil', 'Sherbrooke', 'Saguenay', 'Levis', 'Trois-Rivieres', 'Terrebonne'],
  'Saskatchewan': ['Saskatoon', 'Regina', 'Prince Albert', 'Moose Jaw', 'Swift Current', 'Yorkton', 'North Battleford', 'Estevan', 'Weyburn', 'Lloydminster'],
  'Yukon': ['Whitehorse', 'Dawson City', 'Watson Lake', 'Haines Junction', 'Carmacks', 'Faro', 'Mayo', 'Teslin', 'Carcross', 'Ross River']
};

export const CANADA_PROVINCES = Object.keys(CANADA_PROVINCES_AND_CITIES).sort();
