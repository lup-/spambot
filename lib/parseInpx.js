const fs = require('fs');
const unzipper = require('../bot/node_modules/unzipper');
const {getDb} = require('../bot/modules/Database');

function filterChildren(categories) {
    let notNullCategories = [];
    for (let category of categories) {
        if (category) {
            if (category.children && category.children.length > 0) {
                category.children = filterChildren(category.children);
            }
            notNullCategories.push(category);
        }
    }

    return notNullCategories;
}
function streamToBuffer(stream) {
    let chunks = [];
    let fileBuffer;

    return new Promise((resolve, reject) => {
        stream.once('error', reject);
        stream.once('end', () => {
            fileBuffer = Buffer.concat(chunks);
            resolve(fileBuffer);
        });
        stream.on('data', chunk => {
            chunks.push(chunk);
        });
    });
}

async function unzipFileFrom(fileName, from) {
    const zip = fs.createReadStream(from).pipe(unzipper.Parse({forceStream: true}));
    let unzippedFile = false

    for await (const entry of zip) {
        if (entry.path === fileName) {
            unzippedFile = await streamToBuffer(entry);
        }
        else {
            entry.autodrain();
        }
    }

    return unzippedFile;
}

async function getBookFile(book) {
    let bookFileName = book.id+'.'+book.format;
    let zipFileName = book.archiveName;
    let buffer = await unzipFileFrom(bookFileName, zipFileName);

    return buffer;
}

let libDir = __dirname+'/flibusta_fb2_local.inpx';
let catDir = __dirname+'/MyHomeLib_2_3';

let libPath = fs.realpathSync(libDir);
let catPath = fs.realpathSync(catDir);

let files = fs.readdirSync(libPath).filter(fileName => /\.inp$/i.test(fileName)).slice(0, 1);
let categoryFiles = fs.readdirSync(catPath).filter(fileName => /\.glst$/i.test(fileName));

let categories = {};
let categoriesFlat = [];
for (let fileName of categoryFiles) {
    let catCode = fileName.replace('genres_', '').replace('.glst', '');
    let filePath = fs.realpathSync(catDir+'/'+fileName);
    let catContent = fs.readFileSync(filePath, 'utf8');
    let lines = catContent.split('\n').map(line => line.trim()).filter(line => /^\d/.test(line));

    for (let line of lines) {
        let [index, titleData] = line.split(' ');
        titleData = line.substring(line.indexOf(' ')+1);
        let nums = index.replace(/^0\./, '').split('.').filter(num => num !== "").map(num => parseInt(num));
        let hasCode = titleData.indexOf(';') !== -1;

        let title = false;
        let code = false;

        if (hasCode) {
            [code, title] = titleData.split(';').map(item => item.trim());
        }
        else {
            title = titleData.trim();
        }

        let category = {code, title, type: catCode};

        categoriesFlat.push(category);

        if (!categories[catCode]) {
            categories[catCode] = [];
        }

        let categoryPath = categories[catCode];
        for (const numIndex in nums) {
            let num = nums[numIndex];
            let isLast = parseInt(numIndex) === nums.length -1;

            if (isLast) {
                if (categoryPath[num]) {
                    categoryPath[num].code = category.code;
                    categoryPath[num].title = category.title;
                }
                else {
                    categoryPath[num] = category;
                }
            }
            else {
                if (!categoryPath[num]) {
                    categoryPath[num] = {};
                }

                if (!categoryPath[num].children) {
                    categoryPath[num].children = [];
                }

                categoryPath = categoryPath[num].children;
            }
        }
    }

    categories[catCode] = filterChildren(categories[catCode]);
}

let books = [];
for (let fileName of files) {
    let archiveName = fileName.replace('.inp', '.zip');
    let filePath = fs.realpathSync(libDir+'/'+fileName);
    let inpxContent = fs.readFileSync(filePath, 'utf8');
    let bookEntries = inpxContent.split('\n');

    console.log(fileName + ': ' + bookEntries.length);

    for (let bookEntry of bookEntries) {
        let fields = bookEntry.split('');
        let authors = fields[0].split(':').map(author => author.split(',').join(' ').trim()).filter(author => author !== "");
        let mainAuthor = authors[authors.length - 1];
        let genreCodes = fields[1] ? fields[1].split(':').filter(genre => genre !== "") : [];
        let genreNames = fields[13] ? fields[13].split(',').filter(genre => genre !== "") : [];
        let genres = categoriesFlat.filter( category => category.code && genreCodes.indexOf(category.code) !== -1 ).map(category => category.title);
        let title = fields[2];
        let series = fields[3] || false;
        let volume = fields[4] ? parseInt(fields[4]) : false;
        let id = fields[5];
        let size = parseInt(fields[6]);
        let format = fields[9];
        let dateAdded = fields[10];
        let lang = fields[11];

        let book = { id, authors, mainAuthor, genres, genreCodes, genreNames, title, lang, series, volume, format, size, dateAdded, archiveName};
        books.push(book);
    }
}

(async () => {
    let book = books[0];
    try {
        let file = await getBookFile(book);
        fs.writeFileSync('test.fb2', file.toString());
    }
    catch (e) {
        console.log(e);
    }

    process.exit();

    // let db = await getDb('botofarmer');
    // let allCategories = JSON.parse(JSON.stringify(categories['fb2']));
    // allCategories = allCategories.concat( JSON.parse(JSON.stringify(categories['nonfb2'])) );
    //
    // await db.collection('bookCategories').insertMany(allCategories);
    // await db.collection('books').insertMany(books);
    // process.exit();
})();
