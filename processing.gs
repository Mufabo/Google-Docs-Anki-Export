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