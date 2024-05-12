/**
 * @OnlyCurrentDoc
 */

function onOpen(e) {
  DocumentApp.getUi().createAddonMenu()
    .addItem('Show in sidebar', 'showSidebar')
    .addToUi();
}

function onInstall(e) {
  onOpen(e);
}

function showSidebar() {
  var ui = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('Anki export');
  DocumentApp.getUi().showSidebar(ui);
}

// https://stackoverflow.com/questions/47299478/google-apps-script-docs-convert-selected-element-to-html
var globalNestedListLevel = -1;
var listIds = [];
var listNestLevels = {};
var listCounters = {};

function extractHtmlCardsFromDocument() {
  var flashCards = [];
  var images = [];
  var cardsAndImages;

  writeStatusToCache("unknown", 0);
  cards = findFlashCardsInDocument();
  writeStatusToCache(cards.length, 0);

  // Walk through all found flash cards
  for (var i = 0; i < cards.length; i++) {
    var fc = cards[i];
    var html = [];
    for (var j = 0; j < fc.backItems.length; j++) {
      html.push(processItem_V1(fc.backItems[j], listCounters, images));
    }
    var hash = hashCode(fc.front);
    flashCards.push({ front: fc.front, html: html.join('') });
    writeStatusToCache(cards.length, i + 1);
  }

  var imagesJson = base64EncodeImages(images);

  const ss = DocumentApp.getActiveDocument();
  const ss_id = ss.getId();
  const file = DriveApp.getFileById(ss_id);
  const parent_folders = file.getParents()
  const folder_name = parent_folders.next().getName(); //desired result
  cardsAndImages = { deckName: folder_name, cards: flashCards, images: imagesJson };

  // images are sent together with the flash cards to the client so that we
  // won't have to process the document again when exporting
  // Ideally they should be stored in the CacheService. But since each key can only hold 100kB of data
  // a work around is needed to store larger images in several keys.
  return cardsAndImages;
}

function hashCode(s) {
  var h = 0, l = s.length, i = 0;
  if (l > 0)
    while (i < l)
      h = (h << 5) - h + s.charCodeAt(i++) | 0;
  return h;
};

// Write status to cache so that client can fetch it and update progress
function writeStatusToCache(total, current) {
  var cache = CacheService.getDocumentCache();
  if (total != null)
    cache.put("total", total);
  if (current != null)
    cache.put("current", current);
}

// Called from client to get status
function readStatusFromCache() {
  var cache = CacheService.getDocumentCache();
  var total = cache.get("total");
  var current = cache.get("current");
  return { total: total, current: current };
}

// Encodes an array of images to base64 and stores them together with name and type in an array and returns its' JSON representation
function base64EncodeImages(images) {
  var base64Images = [];

  for (var i = 0; i < images.length; i++) {
    var base64Img = Utilities.base64Encode(images[i].blob.getBytes());
    base64Images.push({ name: images[i].name, type: images[i].type, data: base64Img });
  }

  var json = JSON.stringify(base64Images);
  return json;
}

// Takes an json string encoded by base64EncodeImages() and decodes it into an array of image blobs
function decodeBase64Images(json) {
  var base64Images = [];
  var images = [];

  var base64Images = JSON.parse(json);

  for (var i = 0; i < base64Images.length; i++) {
    var imgBlob = Utilities.newBlob("");
    imgBlob.setBytes(Utilities.base64Decode(base64Images[i].data));
    imgBlob.setName(base64Images[i].name);
    imgBlob.setContentType(base64Images[i].type);
    images.push(imgBlob);
  }
  return images;
}

// Cache can only store 100kB/key
// so as a workaround all images are sent to client :(
function storeImagesInCache(images) {
  var base64Images = [];

  for (var i = 0; i < images.length; i++) {
    var base64Img = Utilities.base64Encode(images[i].blob.getBytes());
    base64Images.push({ name: images[i].name, type: images[i].type, data: base64Img });
  }

  var json = JSON.stringify(base64Images);
  var cache = CacheService.getDocumentCache();
  cache.put("images", json);
}

// Cache can only stor 100kB/key
// so as a workaround all images are sent to client :(
function readImagesFromCache() {
  var base64Images = [];
  var images = [];

  var cache = CacheService.getDocumentCache();
  var json = cache.get("images");
  var base64Images = JSON.parse(json);

  for (var i = 0; i < base64Images.length; i++) {
    var imgBlob = Utilites.newBlob("");
    imgBlob.setBytes() = Utilities.base64Decode(base64Images[i].data);
    imgBlob.setName(base64Images[i].name);
    imgBlob.setContentType(base64Images[i].type);
    images.push(imgBlob);
  }
  return images;
}

function createCsvFromCards(cards) {
  var output = [];
  for (var i = 0; i < cards.length; i++) {
    output.push(cards[i].front);
    output.push('§');
    output.push(cards[i].html);
    output.push("\n\n");
  }
  return output.join('');
}

/*

function exportToGoogleDrive(cardsAndImages)
{
  var images = decodeBase64Images(cardsAndImages.images);
  var csv = createCsvFromCards(cardsAndImages.cards);
  
  var folder = DriveApp.createFolder("Anki-export");
  folder.createFile("ankiexport.txt", csv);
  
  for (var j=0; j<images.length; j++)
  {
    folder.createFile(images[j]);
  }
}

function emailHtml(html, images) {
  var attachments = [];
  for (var j=0; j<images.length; j++) {
    attachments.push( {
      "fileName": images[j].name,
      "mimeType": images[j].type,
      "content": images[j].blob.getBytes() } );
  }

  var inlineImages = {};
  for (var j=0; j<images.length; j++) {
    inlineImages[[images[j].name]] = images[j].blob;
  }

  var name = DocumentApp.getActiveDocument().getName()+".txt";
  attachments.push({"fileName":name, "mimeType": "text/html", "content": html});
  MailApp.sendEmail({
     to: Session.getActiveUser().getEmail(),
     subject: name,
     htmlBody: name + " - konverterad till CSV",
     inlineImages: inlineImages,
     attachments: attachments
   });
}
*/

function findFlashCardsInDocument() {
  var cards = [];
  var item = null;
  var doc = DocumentApp.getActiveDocument();

  /* DEBUG CODE - sets a selection so that it can be debugged
  var b = doc.getBody();
  var rangeBuilder = doc.newRange();
  for (var i = 0; i < 25; i++) 
  {
    rangeBuilder.addElement(b.getChild(i));
  }
  doc.setSelection(rangeBuilder.build());*/

  var selection = doc.getSelection();
  if (selection) {
    var selectedItemCount = selection.getRangeElements().length;
    var selectedElements = selection.getRangeElements();
    var indexOfFirstElement = doc.getBody().getChildIndex(selectedElements[0].getElement());
    Logger.log(selectedItemCount);
    var nextElementIdx = 0;
    while (nextElementIdx < selectedItemCount) {
      var element = selection.getRangeElements()[nextElementIdx].getElement();
      var type = element.getType().toString();
      // The index of the first selected element needs to be subtracted from the returned index
      nextElementIdx = findFlashCardsInItem(element, cards) - indexOfFirstElement;
    }
  }
  else {
    var body = doc.getBody();
    var children = 0;
    if (body.getNumChildren)
      children = body.getNumChildren();

    var nextElementIdx = 0;
    while (nextElementIdx < children) {
      var element = body.getChild(nextElementIdx);
      var type = element.getType().toString();
      nextElementIdx = findFlashCardsInItem(element, cards);
    }
  }
  return cards;
}

function findFlashCardsInItem(item, cardCollection) {
  var type = item.getType().toString();

  if (isHeader(item) && !hasSubHeader(item)) {
    var front = item.getText();
    var backItems = [];

    do {
      var nextSibling = item.getNextSibling();
      var nextHeaderLevel = getHeaderLevel(nextSibling);
      if (nextHeaderLevel == 0) {
        backItems.push(nextSibling);
        item = nextSibling;
      }
    }
    while (nextHeaderLevel == 0 && item.getNextSibling())

    // add card
    cardCollection.push({ front: front, backItems: backItems });
  }
  // return index of next document element
  return item.getParent().getChildIndex(item) + 1;

}

function hasSubHeader(paragraph) {
  var type = paragraph.getType().toString();
  var headerLevel = getHeaderLevel(paragraph);

  var nextSibling = paragraph.getNextSibling();
  if (nextSibling == null)
    return false;

  var nextHeaderLevel = getHeaderLevel(nextSibling);
  while (nextHeaderLevel == 0) {
    var nextSibling = nextSibling.getNextSibling();
    if (nextSibling == null)
      break;
    var nextHeaderLevel = getHeaderLevel(nextSibling);
  }

  return headerLevel < nextHeaderLevel;
}

function getHeaderLevel(paragraph) {
  if (paragraph == null)
    return -1;

  if (paragraph.getHeading) {
    var heading = paragraph.getHeading();
    switch (heading) {
      case DocumentApp.ParagraphHeading.HEADING6:
        return 6;
      case DocumentApp.ParagraphHeading.HEADING5:
        return 5;
      case DocumentApp.ParagraphHeading.HEADING4:
        return 4;
      case DocumentApp.ParagraphHeading.HEADING3:
        return 3;
      case DocumentApp.ParagraphHeading.HEADING2:
        return 2;
      case DocumentApp.ParagraphHeading.HEADING1:
        return 1;
      default:
        return 0;
    }
  }
  else
    return false;
}


function isHeader(item) {
  var text = ""
  if (item.getText) {
    text = item.getText();
    if (text.trim().length == 0)
      return false; // 0 length headers are considered invalid!
  }
  return getHeaderLevel(item) > 0;
}



function convertFlashCardToHtml(index) {
  var html = [];

  //get card from cache
  var cache = CacheService.getPublicCache();
  var cardsJson = cache.get("cards");
  cards = JSON.parse(cardsJson);
  Logger.log(cards);

  for (var i = 0; i < cards[index].backItems.length; i++)
    html.push(processItem_V1(cards[index].backItems[i], listCounters, images));

  return html;
}


/**
 * @param {PositionedImage[]} positionedImages - https://developers.google.com/apps-script/reference/document/positioned-image
 * @param {{"blob": Blob,"type": string,"name": string}[]} images
 * @param {string[]} output
 */
function processPositionedImages(positionedImages, images, output, imagesOptions) {
  //TODO:
  //https://developers.google.com/apps-script/reference/document/positioned-image
}

/**
 * @param {string[]} atts
 */
function dumpAttributes(atts) {
  // Log the paragraph attributes.
  for (var att in atts) {
    if (atts[att]) Logger.log(att + ":" + atts[att]);
  }
}

function getAbsoluteListItemNestLevel(listItem) {
  // get base nest level of list
  // (always depending on context of list)
  var listNestLevel = listNestLevels[listItem.getListId()] || 0;
  var itemNestLevel = listNestLevel + listItem.getNestingLevel();
  return itemNestLevel;
}


//points = pixel * 72 / 96
//1em = 16px (Browser Default wert) 
//1px = 1/16 = 0.0625em 

function pointsToPixel(points) {
  return points * 96 / 72;
}

function pixelToPoints(pixel) {
  return pixel * 72 / 96;
}

function pixelToEm(pixel) {
  return pixel / 16;
}

function emToPixel(em) {
  return em * 16;
}


/**
* @param {Text} item - https://developers.google.com/apps-script/reference/document/text
* @param {string[]} output
*/
function processText(item, output) {
  var text = item.getText();
  var indices = item.getTextAttributeIndices();

  if (text === '\r') {
    Logger.log("\\r: ");
    return;
  }

  for (var i = 0; i < indices.length; i++) {
    var partAtts = item.getAttributes(indices[i]);
    var startPos = indices[i];
    var endPos = i + 1 < indices.length ? indices[i + 1] : text.length;
    var partText = text.substring(startPos, endPos);

    partText = partText.replace(new RegExp("(\r)", 'g'), "<br/>");
    //Logger.log(partText);
    dumpAttributes(partAtts);

    //TODO if only ITALIC use: <blockquote></blockquote>

    //TODO: change html tags to css (i, strong, u)

    //css font-style:italic;
    if (partAtts.ITALIC) {
      output.push('<i>');
    }
    //css font-weight: bold;
    if (partAtts.BOLD) {
      output.push('<strong>');
    }
    //css text-decoration: underline
    if (partAtts.UNDERLINE) {
      output.push('<u>');
    }

    var style = "";

    // font family, color and size changes disabled
    /*if (partAtts.FONT_FAMILY) {
    style = style + 'font-family: ' + partAtts.FONT_FAMILY + '; ';
    }
    if (partAtts.FONT_SIZE) {
    var pt = partAtts.FONT_SIZE;
    var em = pixelToEm(pointsToPixel(pt));
    style = style + 'font-size: ' + pt + 'pt;  font-size: ' + em + 'em; ';
    }
    if (partAtts.FOREGROUND_COLOR) {
    style = style + 'color: ' + partAtts.FOREGROUND_COLOR + '; '; //partAtts.FOREGROUND_COLOR
    }
    if (partAtts.BACKGROUND_COLOR) {
    style = style + 'background-color: ' + partAtts.BACKGROUND_COLOR + '; ';
    }*/
    if (partAtts.STRIKETHROUGH) {
      style = style + 'text-decoration: line-through; ';
    }

    var a = item.getTextAlignment(startPos);
    if (a !== DocumentApp.TextAlignment.NORMAL && a !== null) {
      if (a === DocumentApp.TextAlignment.SUBSCRIPT) {
        style = style + 'vertical-align : sub; font-size : 60%; ';
      } else if (a === DocumentApp.TextAlignment.SUPERSCRIPT) {
        style = style + 'vertical-align : super; font-size : 60%; ';
      }
    }

    // If someone has written [xxx] and made this whole text some special font, like superscript
    // then treat it as a reference and make it superscript.
    // Unfortunately in Google Docs, there's no way to detect superscript
    if (partText.indexOf('[') == 0 && partText[partText.length - 1] == ']') {
      if (style !== "") {
        style = ' style="' + style + '"';
      }
      output.push('<sup' + style + '>' + partText + '</sup>');
    } else if (partText.trim().indexOf('http://') == 0 || partText.trim().indexOf('https://') == 0) {
      if (style !== "") {
        style = ' style="' + style + '"';
      }
      output.push('<a' + style + ' href="' + partText + '" rel="nofollow">' + partText + '</a>');
    } else if (partAtts.LINK_URL) {
      if (style !== "") {
        style = ' style="' + style + '"';
      }
      output.push('<a' + style + ' href="' + partAtts.LINK_URL + '" rel="nofollow">' + partText + '</a>');
    } else {
      if (style !== "") {
        partText = '<span style="' + style + '">' + partText + '</span>';
      }
      output.push(partText);
    }

    if (partAtts.ITALIC) {
      output.push('</i>');
    }
    if (partAtts.BOLD) {
      output.push('</strong>');
    }
    if (partAtts.UNDERLINE) {
      output.push('</u>');
    }

  }
  //}
}