const fs = require('fs');
const YAML = require('yaml');
const showdown = require('showdown');
const { get, set, startCase } = require('lodash');

const mdConverter = new showdown.Converter();

const base = './data';
const data = {};

const parseFile = async (path) => {
    const fileData = await fs.promises.readFile(base + path, { encoding: 'utf8' });
    // The file has to have content, and it has to have separators
    if (fileData.length === 0
        || !fileData.match(/(^|\n)---\n/g)) return;
    // Split the segments to get legal YAML
    const segments = fileData.split('\n---\n');
    // Each file should contain some metadata and some content
    if (segments.length < 2) return;
    // Metadata is always first, the rest is content
    const [metadataYAML, ...contentSegments] = segments;
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
    // For each further segment, attempt to parse it as YAML, Markdown or just return plain text
    content = contentSegments.map(contentStr => {
        let parsed;
        try {
            const yaml = YAML.parse(contentStr);
            // Reviews and content can both contain markdown
            if ('review' in yaml) {
                yaml.review = mdConverter.makeHtml(yaml.review);
            }
            if ('content' in yaml) {
                yaml.content = mdConverter.makeHtml(yaml.content);
            }
            parsed = yaml;
        } catch {}
        if (parsed) return parsed;
        try {
            parsed = mdConverter.makeHtml(contentStr);
        } catch {}
        if (parsed) return parsed;
        return contentStr;
    });
    set(data, path.substr(1, path.length - 4).replace(/\//g, '.'), { metadata, content });
};

const parseDir = async (path) => {
    const files = await fs.promises.readdir(base + path);
    await Promise.all(files.map(async file => {
        const filePath = `${path}/${file}`;
        const stat = await fs.promises.stat(base + filePath);
        if (stat.isDirectory()) {
            await parseDir(filePath);
        } else if (stat.isFile()) {
            await parseFile(filePath);
        }
    }));
};

const init = async () => {
    await parseDir('');
    console.log(data);
    console.log(data.posts[Object.keys(data.posts)[0]]);
    if (!fs.existsSync('./dist')) {
        await fs.promises.mkdir('./dist');
    }
    await fs.promises.writeFile('./dist/reviews.json', JSON.stringify(Object.values(data.posts).filter(i => i.metadata.type === 'reviews')));
    await fs.promises.writeFile('./dist/articles.json', JSON.stringify(Object.values(data.posts).filter(i => i.metadata.type === 'articles')));
};

init();