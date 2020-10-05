const fs = require('fs');
const nodePath = require('path');
const YAML = require('yaml');
const showdown = require('showdown');
const sharp = require('sharp');
const { deburr, set, startCase, uniqueId } = require('lodash');

const footnoteRefExtension = () => [
    {
        type: 'lang',
        filter: (text) => {
            let newText = text;
            const matches = newText.match(/^\[\^([^\]]+?)\]: (.+?)$/gm);
            if (Array.isArray(matches)) {
                matches.forEach(match => {
                    const [fullMatch, symbol, fnText] = match.match(/^\[\^([^\]]+?)\]: (.+?)$/m);
                    const id = uniqueId('footnote-');
                    const refId = `${id}-ref`;
                    newText = newText.replace(fullMatch, `<p class="footnote" id="${id}" role="doc-endnote"><sup>${symbol}</sup> ${fnText} <a href="#${refId}" role="doc-backlink">↩</a></p>`);
                    const refStr = `[^${symbol}]`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // escape any characters with special meaning
                    const refs = newText.match(new RegExp(refStr, 'g'));
                    if (Array.isArray(refs)) {
                        refs.forEach((ref, pos) => {
                            const uid = pos === 0 ? refId : uniqueId(refId);
                            newText = newText.replace(ref, `<sup id="${uid}" role="doc-noteref"><a href="#${id}">${symbol}</a></sup>`)
                        });
                    }
                })
            }
            return newText;
        },
    },
];

const pullquoteExtension = () => [
    {
        type: 'lang',
        regex: /\[([^\]]+)\]\(\+\)/g,
        replace: '<span data-pullquote="$1">$1</span>'
    },
];

const mdConverter = new showdown.Converter({ extensions: [footnoteRefExtension, pullquoteExtension] });
const toHTML = (md) => resolveLocalUrls(mdConverter.makeHtml(md.replace(/([^\n])\n([^\n])/g, '$1\n\n$2')));

const inputBase = './data';
const outputBase = './dist';
const postBase = '/posts';
const pageBase = '/pages';
const imagesBase = '/images';
const tagsBase = '/tags';
const segmentDetector = /(^|\r?\n?)---\r?\n/;
const segmentDivisor = /\r?\n---\r?\n/;
const localImage = /(?<=<img)([^>]+?src=")(?!http)([^"]+?)"/g;
const localLink = /(?<=<a )([^>]*?href=")(?!http)(?!mailto)(?!#)(\/{0,1})([^"]+?)"/g;

let imageConfig = {};
const imagesSizes = [];
const imageMax = {};
const data = {};

const getPathParts = filePath => {
    const [match, path, file, extension] = filePath.match(/^(.+?)([^/]+?)(\.[a-zA-Z]{1,4})$/);
    return { path, file, extension };
};

// Pull the image generation out
// Needs to apply to article images too
// When resolving images, add in srcset
const generateImages = async (originalPath) => {
    const sizeObj = {};
    const imagePath = `/${originalPath}`;
    const { path: outputImagePath, file: outputImageFile, extension } = getPathParts(imagePath);
    if (!fs.existsSync(outputBase + imagesBase + outputImagePath)) {
        await fs.promises.mkdir(outputBase + imagesBase + outputImagePath, { recursive: true });
    }
    const inputImageFilePath = inputBase + imagesBase + imagePath;
    if (!fs.existsSync(inputImageFilePath)) {
        throw Error(`Image "${inputImageFilePath}" could not be found.`);
    }
    const image = sharp(inputImageFilePath);
    const metadata = await image.metadata();
    imageMax[originalPath] = { w: metadata.width, h: metadata.height };
    await Promise.all(
        imagesSizes.map(({ name, w, h }) => {
            const sizePath = `${imagesBase}${outputImagePath}${outputImageFile}-${name}${extension}`;
            sizeObj[name] = process.env.API_URL + sizePath;
            return image.clone()
                .resize(w, h, { withoutEnlargement: true })
                .toFile(outputBase + sizePath);
        }),
    );
    return sizeObj;
}

const resolveLocalUrls = async (html) => {
    const images = html.match(localImage);
    if (Array.isArray(images)) {
        await Promise.all(
            images.map(async (image) => {
                const [match, src] = image.match(/src="([^"]+?)"/);
                const { path, file, extension } = getPathParts(src);
                await generateImages(src);
                const max = imageMax[src];
                const sizes = Object.entries(imageConfig.sizes);
                let srcset = '';
                let i = 0;
                let joiner = '';
                do {
                    const [size, width] = sizes[i];
                    srcset += `${joiner}${process.env.API_URL}${imagesBase}/${path}${file}-${size}-original${extension} ${Math.min(width, max.w)}w`;
                    joiner = ',\n';
                    i++;
                } while (i < sizes.length && sizes[i - 1][1] < max.w);
                let imageWithAttributes = `${image.replace(file, `${file}-medium-original`)} srcset="${srcset}" sizes="(max-width: ${max.w}px) 100vw, ${max.w}px" loading="lazy"`;
                if (image.indexOf('width=') === -1 && image.indexOf('height=') === -1) {
                    imageWithAttributes += ` width="${max.w}" height="${max.h}"`;
                }

                html = html.replace(image, imageWithAttributes);
            }),
        );
    }
    return html.replace(localImage, `$1${process.env.API_URL}/images/$2"`)
        .replace(localLink, `$1${process.env.SITE_URL}/$3"`);
}

const processContentFile = async (path, metadataYAML, contentSegments) => {
    // We infer some information from the filename
    const parsedPath = nodePath.parse(path);
    const metadata = {
        slug: parsedPath.name,
    };
    const postTitle = path.match(/(\d{4})(\d{2})(\d{2})-([^-]+?)-(.+?)\.md$/);
    if (postTitle) {
        const [match, year, month, day, type, slug] = postTitle;
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        Object.assign(metadata, {
            slug,
            type,
            created: date,
        });
    }
    metadata.title = startCase(metadata.slug);
    let content = [];
    try {
        // Anything parsed from the first segment as YAML will overwrite and add to the defaults
        Object.assign(metadata, YAML.parse(metadataYAML));
    } catch {}
    if (!('modified' in metadata) && 'created' in metadata) {
        metadata.modified = metadata.created;
    }
    if (!('blurb' in metadata) && 'summary' in metadata) {
        metadata.blurb = metadata.summary;
    }
    if ('featuredimage' in metadata) {
        metadata.featuredimage = await generateImages(metadata.featuredimage);
    }
    // For each further segment, attempt to parse it as YAML, Markdown or just return plain text
    content = await Promise.all(contentSegments.map(async (contentStr) => {
        let parsed;
        try {
            const yaml = YAML.parse(contentStr);
            // Reviews and content can both contain markdown
            if ('review' in yaml) {
                yaml.review = await toHTML(yaml.review);
            }
            if ('content' in yaml) {
                yaml.content = await toHTML(yaml.content);
            }
            if ('body' in yaml) {
                yaml.body = await toHTML(yaml.body);
            }
            parsed = yaml;
        } catch {}
        if (parsed) return parsed;
        try {
            parsed = await toHTML(contentStr);
        } catch {}
        if (parsed) return parsed;
        return contentStr;
    }));
    return { metadata, content };
};

const parseFile = async (path) => {
    const fileData = await fs.promises.readFile(inputBase + path, { encoding: 'utf8' });
    // The file has to have content, and it has to have separators
    if (fileData.length === 0
        || !fileData.match(segmentDetector)) return;
    // Split the segments to get legal YAML
    const segments = fileData.split(segmentDivisor);
    // Metadata is always first, the rest is content
    const [metadataYAML, ...contentSegments] = segments;
    // Each file should at least contain some metadata
    if (!metadataYAML) return;
    let item;
    if (contentSegments.length > 0) {
        // We're reading a content file, they require further processing
        item = await processContentFile(path, metadataYAML, contentSegments);
    }
    if (!item) {
        item = YAML.parse(metadataYAML);
    }
    set(data, path.substr(1, path.length - 4).replace(/\//g, '.'), item);
};

const parseDir = async (path) => {
    const files = await fs.promises.readdir(inputBase + path);
    await Promise.all(files.map(async file => {
        const filePath = `${path}/${file}`;
        const stat = await fs.promises.stat(inputBase + filePath);
        if (stat.isDirectory()) {
            await parseDir(filePath);
        } else if (stat.isFile()) {
            await parseFile(filePath);
        }
    }));
};

const resolveImageSizes = ({ variations, sizes }) => Object.entries(sizes)
    .forEach(([label, w]) => Object.entries(variations)
        .forEach(([variation, ratio]) => imagesSizes.push({
            name: `${label}-${variation}`,
            h: Number.isFinite(ratio) ? w / ratio : undefined,
            w,
        })));

const resolveAuthor = (obj) => {
    const resolveSingle = (ref) => {
        const author = ref.toLowerCase();
        const deburred = deburr(author);
        if (author in data.authors) {
            return { ...data.authors[author], slug: author };
        }
        if (deburred in data.authors) {
            return { ...data.authors[deburred], slug: deburred };
        }
        let authorObj;
        Object.entries(data.authors).some(([key, value]) => {
            if (deburr(key) === deburred) {
                authorObj = { ...value, slug: key };
                return true;
            }
            return false;
        });
        return authorObj;
    }
    switch(typeof obj.author) {
        case 'object':
            if (Array.isArray(obj.author)) {
                // An array of multiple authors, resolve any string values
                const authors = obj.author
                    .filter(ref => typeof ref === 'string')
                    .map(ref => resolveSingle(ref))
                    .filter(obj => typeof obj === 'object');
                if (authors.length === 0) {
                    delete obj.author;
                    return;
                }
                obj.author = {
                    name: authors.reduce((acc, val, ind, arr) => {
                        let joiner = ', ';
                        if (ind === 0) {
                            joiner = '';
                        } else if (ind === arr.length - 1) {
                            joiner = ' & ';
                        }
                        return acc.concat(joiner, val.name);
                    }, ''),
                    authors,
                }
                return;
            }
            // Maybe this has already been resolved? Unlikely; no-op
            return;
        case 'string':
            // Single author, original use case
            // TODO: Should we return an array here too for consistency?
            const author = resolveSingle(obj.author);
            if (typeof author !== 'object') {
                delete obj.author;
                return;
            }
            obj.author = {
                name: author.name,
                authors: [author],
            };
            return;
        default:
            // No-op, we can't resolve this
    }
}

const generateResponse = (obj, name) => {
    return fs.promises.writeFile(`./dist/${name}.json`, JSON.stringify(obj));
};

const init = async () => {
    // Load image sizes
    imageConfig = JSON.parse(
        await fs.promises.readFile(
            `${inputBase}${imagesBase}/sizes.json`,
            { encoding: 'utf8' },
        ),
    );
    resolveImageSizes(imageConfig);

    // Parse data
    await parseDir('');

    const postsArr = Object.values(data.posts).sort((a, b) => {
        const aDate = new Date(a.metadata.created);
        const bDate = new Date(b.metadata.created);
        return ((aDate < bDate) * 2) - 1;
    });

    // Group posts by type
    const typeGrouping = {};
    // Group posts by tag
    const tagGrouping = {};
    for (let post of postsArr) {
        // Author resolution
        resolveAuthor(post.metadata);
        post.content.forEach(item => {
            if (typeof item === 'object' && item !== null) {
                resolveAuthor(item);
            }
        });

        // Type grouping
        const type = post.metadata.type;
        if (!(type in typeGrouping)) {
            typeGrouping[type] = [];
        }
        typeGrouping[type].push(post);

        // Tag aggregation
        const postTags = post.metadata.tags;
        if (Array.isArray(postTags)) {
            postTags.forEach(tag => {
                if (!(tag in tagGrouping)) {
                    tagGrouping[tag] = [];
                }
                tagGrouping[tag].push(post);
            })
        }
    }

    await Promise.all(['', postBase, pageBase, imagesBase, tagsBase].map(dir => {
        const checkPath = outputBase + dir;
        if (!fs.existsSync(checkPath)) {
            return fs.promises.mkdir(checkPath, { recursive: true });
        }
        return Promise.resolve();
    }))

    await Promise.all([
        ...Object.entries(typeGrouping).map(([type, post]) => generateResponse(post.map(post => ({ metadata: post.metadata })), type)),
        generateResponse(Object.entries(typeGrouping).reduce((acc, [type, posts]) => Object.assign(acc, { [type]: posts.slice(0, 9).map(post => ({ metadata: post.metadata })) }), {}), 'latest'),
        ...Object.entries(typeGrouping).map(([type, posts]) => Promise.all(posts.map(post => generateResponse(post, `posts/${type}-${post.metadata.slug}`)))),
        generateResponse(data.authors, 'authors'),
        ...Object.values(data.pages).map(page => generateResponse(page, `pages/${page.metadata.slug}`)),
        generateResponse(Object.keys(tagGrouping), 'tags'),
        ...Object.entries(tagGrouping).map(([tag, post]) => generateResponse(post.map(post => ({ metadata: post.metadata })), `tags/${tag}`)),
        generateResponse(typeGrouping.reviews.slice(0, 22).map(({ metadata }) => ({
            image: metadata.featuredimage['small-square'],
            score: metadata.totalscore.given,
            artist: metadata.artist,
            album: metadata.album,
            slug: metadata.slug,
        })), 'albumbanner'),
        generateResponse({
            pages: Object.values(data.pages).map(page => page.metadata.slug),
            postTypes: Object.keys(typeGrouping),
        }, 'types'),
    ]);
};

init();