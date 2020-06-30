# audioxide-data

This repository stores the data and generator for the Audioxide API.

## Layout

### Data

Files are made up of multiple [YAML and Markdown files](https://learn-the-web.algonquindesign.ca/topics/markdown-yaml-cheat-sheet/). Sections are divided by a new line with three dashes (i.e. `---`).

1. The first section of any file contains metadata about the post/author/entity the file describes.
2. Any section that follows may either contain YAML syntax, with custom data (such as review information) alongside section content in a `review`, `content` or `body` property, or markdown formatted content or a plain string.

**NB:** All data in this repository should be treated as public!

#### Post files

Post files should contain at least two sections: metadata, and at least one content section.

##### Filename inference

The filename of a post file can also contain data about the post. This makes for a handy shorthand method of adding and editing data.

Post filenames should be formatted as `[date]-[post type]-[slug].md` and these values will be used if no other value is specified in the post metadata section. The post title will also be inferred from the slug if one is not specified, by replacing hyphens with spaces and converting the string to sentence case.

The date should be formatted as `YYYYMMDD`.

To override any of the data in these values, specify `created` and/or `modified` dates, `type`, `slug` and `title` in the post metadata section of the file.

###### Example

Where post filename = `20200422-reviews-eob-earth.md`

The following post metadata will be inferred:

```
created: 2020-04-22T00:00:00Z   # Wednesday 22nd April 2020
modified: 2020-04-22T00:00:00Z   # Wednesday 22nd April 2020
type: reviews
slug: eob-earth
title: Eob earth
```

##### Post file example

```yaml
---
created: 2020-04-22T00:00:00Z   # Can be inferred from the filename
modified: 2020-04-22T00:00:00Z  # The created date will be used in unspecified
slug: the-slug-url              # Can be inferred from the filename
title: The Slug URL             # Can be inferred from the slug in the filename
type: article                   # Can be inferred from the filename
tags:                           # Optional
  - 2010s                       # Specify as one per line or ["in", "an", "array"] format
  - "22"
  - bat for lashes
featuredimage: 2016/06/file.png # Relates to a path from the ./data/images directory
author: fred                    # Relates to an author file in ./data/authors directory
blurb: Lorem ipsum dolor        # Used as an SEO description; optional; summary used if unspecified
summary: Lorem ipsum dolor      # Used as a by line in articles and a long, conclusive review summary; optional for articles
artistMBID: 00000000-0000-0000  # A MusicBrainz ID for the artist; mainly for reviews; used to pull artist information; optional
albumMBID: 00000000-0000-0000   # A MusicBrainz ID for the album; mainly for reviews; used to pull album information; optional
# All items from here on are only used in reviews. This line is a comment, and not necessary in the file
album: Some Album
artist: Some Artist
essentialtracks:                # As with tags, tracks may be specified one per line...
  - Vampires                    # ...or in array format
  - Feel for You
favouritetracks:                # As with tags...
  - So Good
totalscore:                     # Currently, the total score must at least specify the given and possible properties
  given: 22                     # This is a bit verbose and will be easier in future
  possible: 30
  fraction: 0.7333333333333333
colours:                        # As with tags...
  - "#9b1713"
  - "#f8f0ee"
  - "#f8f0ee"
pullquote: An '80s love letter  # A very short, pithy summary of the review
week: 207                       # The week number for this review
---
This is an example of a content section. I am able to use markdown syntax such as **bold** and _italics_.

I can also freely spread content across multiple lines.

The only caveat is that horizontal rules must have more than three dashes such as

-----

or the HTML tag

<hr />

otherwise this content will count as a new content section.
---
author: andrew
review: >-
 This is another content section, but it uses YAML syntax to provide further metadata about this
 specific section of content, such as the section author. This is most used by reviews, where each
 section is written by a different person.

 I can still write across multiple lines, and write in **bold** and _italics_.

 Note the single space indentation at the start of each line. YAML is pretty relaxed with this, but
 you should _at least_ have this indentation on the **first** line of the content.
tracks:         # As with tags above, both per line and array format/single line are acceptable
  - So Good
  - ­­Vampires
  - ­­Jasmine
score:          # To make scores even stupider, notice that here, a "score" and "max" property are required
  score: 7      # This is verbose and inconsistent with the totalscore above and will be better in the future
  max: 10
  fraction: 0.7
artistMBID: 00000000-0000-0000  # A MusicBrainz ID for the artist solely discussed in this section; used by articles; optional
albumMBID: 00000000-0000-0000   # A MusicBrainz ID for the album solely discussed in this section; used by articles; optional
---
We can continue to write as many content sections as we like in either format.

Note also, that Markdown allows for HTML tags to be used within it, allowing for more involved styling
to be used in content
```

#### Author files

Author files are currently simple, they contain a required `name` property and an optional set of `links`. The name property is the authors full name. There is not currently an option to display just a first or last name.

##### Author links

An author can have any number of links attached to them but each set of links must set a `default`. Other links may be displayed in more in-depth contexts such as author pages. Currently, the following special link types are handled by the andrewbridge/audioxide-nuxt frontend:

- `twitter`
- `facebook`
- `instagram`
- `email`

All other links will be treated as plain URLs, although specifying `website` will do. Because a key-value structure is currently used, multiple special links are not supported. Multiple plain URLs may be specified with different keys.

##### Example

```yaml
---
name: John      # This will be used as a display name for this author
links:          # A key-value store of links attached to this author
  twitter: sometwitterhandle        # Note that the @ character should NOT be included
  facebook: somefacebookhandle
  instagram: someinstagramhandle
  email: user@example.com           # Note that mailto: should NOT be included
  website: https://www.example.com  # Note the full URL, including "https://" is included
  default: twitter                  # Relates to a key specified above; used under author names in posts
```

#### Images

Images have been imported directly from the Wordpress upload directory, and as such have a `YYYY/MM/file.jpg` format. This format is **not** required, but may be worth continuing with or reorganising entirely. However, as post files manually reference image paths, reorganisation would require re-referencing, which would need some code automation to do sanely.

During generation, images are regenerated at multiple sizes and aspect ratios to allow for performant and flexible display in the site. These sizes are determined by the `./data/images/sizes.json` file. This file provides a name for a size, and specifies width (or `w`) and, optionally, height (or `h`). If no height is specified, the same value as width is used.

Files will only be reduced and cropped and will not be enlarged if they are smaller than the size specified.

### Non-data files

- `generate.js`
    - Generates various JSON files containing different versions, collections, groupings and transformations of the data. Additionally handles the resizing and generation of image files. The files generated are used as the Audioxide API responses.
- `import.js` _(Deprecated)_
    - The initial import script to import data from Wordpress to this new format. Included here for posterity as multiple manual edits have since been applied to the data store.
- `importImages.js` _(Deprecated)_
    - Similar to `import.js`, this file is included for posterity, and was used to initially copy and collect all distinct image sizes.
- `netlify.toml`
    - The product of this repository is hosted by Netlify. We use their configuration file format to provide data access only to websites on the audioxide.com domain or subdomains.
- `./api`
    - This used the Wordpress API to pull data as part of the initial data import.