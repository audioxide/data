const fs = require('fs');
const YAML = require('yaml');
const showdown = require('showdown');
const sharp = require('sharp');
const { deburr, set, startCase } = require('lodash');

const mdConverter = new showdown.Converter();

const inputBase = './data';
const outputBase = './dist';
const postBase = '/posts'
const imagesBase = '/images';
const tagsBase = '/tags';
const segmentDetector = /(^|\r?\n?)---\r?\n/;
const segmentDivisor = /\r?\n---\r?\n/;
const localImage = /(?<=<img)([^>]+?src=")(?!http)([^"]+?)"/g;
const localLink = /(?<=<a )([^>]*?href=")(?!http)(?!mailto)([^"]+?)"/g;

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
    imageMax[originalPath] = (await image.metadata()).width;
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
                images.map(image => {
                    const [match, src] = image.match(/src="([^"]+?)"/);
                    const { path, file, extension } = getPathParts(src);
                    const imageGeneration = generateImages(src);
                    const max = imageMax[src] || Infinity;
                    const srcset = Object.entries(imageConfig.sizes)
                        .map(([size, width]) => `${path}${file}-${size}-original${extension} ${Math.min(width, max)}w`);

                    html = html.replace(image, `${image} srcset="${srcset.join(',\n')}"`);

                    return imageGeneration;
                }),
            );
        }
        return html.replace(localImage, `$1${process.env.API_URL}/images/$2"`)
            .replace(localLink, `$1${process.env.SITE_URL}/$2"`);
    }

    const processContentFile = async (path, metadataYAML, contentSegments) => {
        // We infer some information from the filename
        const [match, year, month, day, type, slug] = path.match(/(\d{4})(\d{2})(\d{2})-([^-]+?)-(.+?)\.md$/);
        const title = startCase(slug);
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        let metadata = {
            slug,
            title,
            type,
            created: date,
        };
        let content = [];
        try {
            // Anything parsed from the first segment as YAML will overwrite and add to the defaults
            Object.assign(metadata, YAML.parse(metadataYAML));
        } catch {}
        if (!('modified' in metadata)) {
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
                yaml.review = await resolveLocalUrls(mdConverter.makeHtml(yaml.review));
            }
            if ('content' in yaml) {
                yaml.content = await resolveLocalUrls(mdConverter.makeHtml(yaml.content));
            }
            if ('body' in yaml) {
                yaml.body = await resolveLocalUrls(mdConverter.makeHtml(yaml.body));
            }
            parsed = yaml;
        } catch {}
        if (parsed) return parsed;
        try {
            parsed = await resolveLocalUrls(mdConverter.makeHtml(contentStr));
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
    if ('author' in obj) {
        const author = obj.author.toLowerCase();
        const deburred = deburr(author);
        if (author in data.authors) {
            obj.author = { ...data.authors[author], slug: author };
            return;
        }
        if (deburred in data.authors) {
            obj.author = { ...data.authors[deburred], slug: deburred };
            return;
        }
        Object.entries(data.authors).some(([key, value]) => {
            if (deburr(key) === deburred) {
                obj.author = { ...value, slug: key };
                return true;
            }
            return false;
        });
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

    await Promise.all(['', postBase, imagesBase, tagsBase].map(dir => {
        const checkPath = outputBase + dir;
        if (!fs.existsSync(checkPath)) {
            return fs.promises.mkdir(checkPath, { recursive: true });
        }
        return Promise.resolve();
    }))

    await Promise.all([
        ...Object.entries(typeGrouping).map(([type, post]) => generateResponse(post.map(post => post.metadata), type)),
        generateResponse(Object.entries(typeGrouping).reduce((acc, [type, posts]) => Object.assign(acc, { [type]: posts.slice(0, 9).map(post => post.metadata) }), {}), 'latest'),
        ...Object.entries(typeGrouping).map(([type, posts]) => Promise.all(posts.map(post => generateResponse(post, `posts/${type}-${post.metadata.slug}`)))),
        generateResponse(data.authors, 'authors'),
        generateResponse(Object.keys(tagGrouping), 'tags'),
        ...Object.entries(tagGrouping).map(([tag, post]) => generateResponse(post.map(post => post.metadata), `tags/${tag}`)),
        generateResponse(typeGrouping.reviews.slice(0, 22).map(({ metadata }) => ({
            image: metadata.featuredimage['small-square'],
            score: metadata.totalscore.given,
            artist: metadata.artist,
            album: metadata.album,
            slug: metadata.slug,
        })), 'albumbanner'),
    ]);
};

init();