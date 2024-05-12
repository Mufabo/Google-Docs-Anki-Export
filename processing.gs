function processImage(item, images, output) {
  images = images || [];
  var blob = item.getBlob();
  var contentType = blob.getContentType();
  var extension = "";
  if (/\/png$/.test(contentType)) {
    extension = ".png";
  } else if (/\/gif$/.test(contentType)) {
    extension = ".gif";
  } else if (/\/jpe?g$/.test(contentType)) {
    extension = ".jpg";
  } else {
    throw "Unsupported image type: " + contentType;
  }
  var imagePrefix = DocumentApp.getActiveDocument().getName() + "_image_";
  var imageCounter = images.length;
  var name = imagePrefix + imageCounter + extension;
  blob.setName(name);
  imageCounter++;
  output.push('<br><img src="' + name + '" />');
  images.push({
    "blob": blob,
    "type": contentType,
    "name": name
  });
}

function processParagraph(item) {

}


/**
* @param {Element} item - https://developers.google.com/apps-script/reference/document/element
* @param {Object} listCounters
* @param {{"blob": Blob,"type": string,"name": string, "height": number, "width": number}[]} images
* @returns {string}
*/
function processItem_V1(item, listCounters, images, imagesOptions, footnotes) {
  var output = [];
  var prefix = "",
    suffix = "";
  var style = "";

  var hasPositionedImages = false;
  if (item.getPositionedImages) {
    positionedImages = item.getPositionedImages();
    hasPositionedImages = true;
  }

  var itemType = item.getType();

  if (itemType === DocumentApp.ElementType.PARAGRAPH) {
    //https://developers.google.com/apps-script/reference/document/paragraph

    if (item.getNumChildren() == 0) {
      return "<br />";
    }

    var p = "";

    if (item.getIndentStart() != null) {
      p += "margin-left:" + item.getIndentStart() + "; ";
    } else {
      // p += "margin-left: 0; "; // superfluous
    }

    //Text Alignment
    switch (item.getAlignment()) {
      // Add a # for each heading level. No break, so we accumulate the right number.
      //case DocumentApp.HorizontalAlignment.LEFT:
      //  p += "text-align: left;"; break;
      case DocumentApp.HorizontalAlignment.CENTER:
        p += "text-align: center;";
        break;
      case DocumentApp.HorizontalAlignment.RIGHT:
        p += "text-align: right;";
        break;
      case DocumentApp.HorizontalAlignment.JUSTIFY:
        p += "text-align: justify;";
        break;
      default:
        p += "";
    }

    if (p !== "") {
      style = 'style="' + p + '"';
    }

    //Heading or only paragraph
    switch (item.getHeading()) {
      // Add a # for each heading level. No break, so we accumulate the right number.
      case DocumentApp.ParagraphHeading.HEADING6:
        prefix = "<h6 " + style + ">", suffix = "</h6>";
        break;
      case DocumentApp.ParagraphHeading.HEADING5:
        prefix = "<h5 " + style + ">", suffix = "</h5>";
        break;
      case DocumentApp.ParagraphHeading.HEADING4:
        prefix = "<h4 " + style + ">", suffix = "</h4>";
        break;
      case DocumentApp.ParagraphHeading.HEADING3:
        prefix = "<h3 " + style + ">", suffix = "</h3>";
        break;
      case DocumentApp.ParagraphHeading.HEADING2:
        prefix = "<h2 " + style + ">", suffix = "</h2>";
        break;
      case DocumentApp.ParagraphHeading.HEADING1:
        prefix = "<h1 " + style + ">", suffix = "</h1>";
        break;
      default:
        prefix = "<p " + style + ">", suffix = "</p>";
    }

    var attr = item.getAttributes();
  } else if (itemType === DocumentApp.ElementType.INLINE_IMAGE) {
    processImage(item, images, output, imagesOptions);
  } else if (itemType === DocumentApp.ElementType.INLINE_DRAWING) {
    //TODO
    Logger.log("INLINE_DRAWING: " + JSON.stringify(item));
  } else if (itemType === DocumentApp.ElementType.LIST_ITEM) {
    var listItem = item;
    var text = listItem.getText();
    var gt = listItem.getGlyphType();
    var key = listItem.getListId()// + '.' + listItem.getNestingLevel();

    if (listIds.indexOf(key) < 0) {
      listIds.push(key);
      prefix += "<ul>"//;, suffix = '</ul>';
      globalNestedListLevel++;
      listNestLevels[key] = globalNestedListLevel;
    }

    // get base nest level of list
    // (always depending on context of list)
    var listNestLevel = listNestLevels[key] || 0;
    var itemNestLevel = getAbsoluteListItemNestLevel(listItem);//)listNestLevel + listItem.getNestingLevel();

    while (itemNestLevel > globalNestedListLevel) {
      prefix += "<ul>"//;, suffix = '</ul>';
      globalNestedListLevel++;
    }


    prefix += "<li>", suffix = '</li>';

    // list added - increase counter
    var counter = listCounters[key + "." + itemNestLevel] || 0;
    counter++;
    listCounters[key + "." + itemNestLevel] = counter;

    // debug
    //prefix += ' ' + key + " - " + listItem.getNestingLevel().toString() + " - ";

    var nextSibling = listItem.getNextSibling();
    //var nextSiblingType = nextSibling.getType().toString();
    var isAtDocumentEnd = listItem.isAtDocumentEnd();
    var nextIsListItem = (nextSibling && (nextSibling.getType() == DocumentApp.ElementType.LIST_ITEM));
    var nextIsSameListId = false;
    if (nextIsListItem)
      nextIsSameListId = nextSibling.getListId() == listItem.getListId();
    var currentNestingLevel = listItem.getNestingLevel();

    var nextNestingLevel = false;
    if (nextIsListItem) {
      // known list? Get absolute nesting level!
      if (listIds.indexOf(nextSibling.getListId()) >= 0)
        nextNestingLevel = getAbsoluteListItemNestLevel(nextSibling);
      else // else global nesting level is base
        nextNestingLevel = globalNestedListLevel + nextSibling.getNestingLevel();
    }
    var nextIsLowerNestingLevel = (nextIsListItem && (nextNestingLevel < globalNestedListLevel));

    while ((isAtDocumentEnd || (!nextIsListItem) || nextIsLowerNestingLevel) && globalNestedListLevel >= 0) {
      suffix += "</ul>";
      globalNestedListLevel--;

      nextSibling = listItem.getNextSibling();
      //  nextSiblingType = nextSibling.getType().toString();
      isAtDocumentEnd = listItem.isAtDocumentEnd();
      nextIsListItem = (nextSibling && (nextSibling.getType() == DocumentApp.ElementType.LIST_ITEM));
      nextIsSameListId = false;
      if (nextIsListItem)
        nextIsSameListId = nextSibling.getListId() != listItem.getListId();

      nextNestingLevel = false;
      if (nextIsListItem) {
        // known list? Get absolute nesting level!
        if (listIds.indexOf(nextSibling.getListId()) > 0)
          nextNestingLevel = getAbsoluteListItemNestLevel(nextSibling);
        else // else global nesting level is base
          nextNestingLevel = globalNestedListLevel + nextSibling.getNestingLevel();
      }
      var nextIsLowerNestingLevel = (nextIsListItem && (nextNestingLevel < globalNestedListLevel));

      nextIsLowerNestingLevel = (nextIsListItem && (getAbsoluteListItemNestLevel(nextSibling) < globalNestedListLevel));
    }
    //   else
    //   {
    //     counter++;
    //  listCounters[key] = counter;
    //  }
  } else if (itemType === DocumentApp.ElementType.TABLE) {
    var row = item.getRow(0)
    var numCells = row.getNumCells();
    var tableWidth = 0;

    for (var i = 0; i < numCells; i++) {
      tableWidth += item.getColumnWidth(i);
    }
    Logger.log("TABLE tableWidth: " + tableWidth);

    //https://stackoverflow.com/questions/339923/set-cellpadding-and-cellspacing-in-css
    var style = ' style="border-collapse: collapse; width:' + tableWidth + 'px; "';

    prefix = '<table' + style + '>', suffix = "</table>";
    //Logger.log("TABLE: " + JSON.stringify(item));
  } else if (itemType === DocumentApp.ElementType.TABLE_ROW) {

    var minimumHeight = item.getMinimumHeight();
    Logger.log("TABLE_ROW getMinimumHeight: " + minimumHeight);

    prefix = "<tr>", suffix = "</tr>";
    //Logger.log("TABLE_ROW: " + JSON.stringify(item));
  } else if (itemType === DocumentApp.ElementType.TABLE_CELL) {

    var colSpan = item.getColSpan();
    Logger.log("TABLE_CELL getColSpan: " + colSpan);
    // colspan="3"

    var rowSpan = item.getRowSpan();
    Logger.log("TABLE_CELL getRowSpan: " + rowSpan);
    // rowspan ="3"

    //TODO: WIDTH must be recalculated in percent
    var atts = item.getAttributes();

    var style = ' style=" width:' + atts.WIDTH + 'px; border: 1px solid black; padding: 5px;"';
  
    prefix = '<td' + style + '>', suffix = "</td>";
    //Logger.log("TABLE_CELL: " + JSON.stringify(item));
  } else if (itemType === DocumentApp.ElementType.FOOTNOTE) {
    //TODO
    var note = item.getFootnoteContents();
    var counter = footnotes.length + 1;
    output.push("<sup><a name='link" + counter + "' href='#footnote" + counter + "'>[" + counter + "]</a></sup>");
    var newFootnote = "<aside class='footnote' epub:type='footnote' id='footnote" + counter + "'><a name='footnote" + counter + "' epub:type='noteref'>[" + counter + "]</a>";
    var numChildren = note.getNumChildren();
    for (var i = 0; i < numChildren; i++) {
      var child = note.getChild(i);
      newFootnote += processItem_V1(child, listCounters, images, imagesOptions, footnotes);
    }
    newFootnote += "<a href='#link" + counter + "' id='#link" + counter + "'>↩</a></aside>"
    footnotes.push(newFootnote);
    Logger.log("FOOTNOTE: " + JSON.stringify(item));
  } else if (itemType === DocumentApp.ElementType.HORIZONTAL_RULE) {
    output.push("<hr />");
    //Logger.log("HORIZONTAL_RULE: " + JSON.stringify(item));
  } else if (itemType === DocumentApp.ElementType.UNSUPPORTED) {
    Logger.log("UNSUPPORTED: " + JSON.stringify(item));
  }

  output.push(prefix);

  if (hasPositionedImages === true) {
    processPositionedImages(positionedImages, images, output, imagesOptions);
  }

  if (item.getType() == DocumentApp.ElementType.TEXT) {
    processText(item, output);
  } else {

    if (item.getNumChildren) {
      var numChildren = item.getNumChildren();

      // Walk through all the child elements of the doc.
      for (var i = 0; i < numChildren; i++) {
        var child = item.getChild(i);
        output.push(processItem_V1(child, listCounters, images, imagesOptions, footnotes));
      }
    }

  }

  output.push(suffix);
  return output.join('');
}