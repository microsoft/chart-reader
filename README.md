# Chart Reader

## About
This is the working repository for the __Chart Reader__ user study. This project is a longitudinal, participatory design study where screen reader users provide feedback and ideas on data experiences (e.g., charts).

## Code
This repository contains two sections, each with their own build scripts and outputs:

1. __Chart Reader Source__ resides in the `./src/` directory. Each sub-directory (e.g., `./src/v1/`, `./src/v2/`) is a unique version of the prototype charting library. Unique versions are used to support iterative updates to charting library between sessions with participants. The charting libraries are built using `npm` or `yarn`. The build outputs to `./study_site/js_build/` as bundled `*.js` files.
2. __Study Site__ resides in the `./study_site/` directory. This is a Jekyll website - Markdown files (e.g., `/study_site/index.md`) generate a static website based on template HTML files (`./study_site/_includes/` and `./study_site/_layouts/`). The Jekyll build outputs to `./study_site/_site/`.

This project also contains a GitHub action which will build the project and push the outputs to the Azure host server at https://chart-reader.websites.net

## Install
This repository requires the following package managers and build frameworks:
1. [yarn](https://classic.yarnpkg.com/en/docs/install)
2. [Ruby and RubyGems](https://www.ruby-lang.org/en/downloads/)
3. [jekyll and bundler Gems](https://jekyllrb.com/docs/) with `gem install jekyll bundler`

Then install the package dependencies for both sections of the project structure:

1. `yarn install` for __Chart Reader Source__ 
2. `bundle install` for __Study Site__


## Build

1. `yarn run build` builds the __Chart Reader Source__
2. `cd .\study_site\` and then `bundle exec jekyll serve` builds and serves __Study Site__ to localhost