window.ST = window.ST || {};

ST.thumbnailStripe = function(container, elements, opts) {
  // Options
  opts = opts || {};
  var selectedClass = opts.selectedClass || "selected";
  var thumbnailWidth = opts.thumbnailWidth || 60;

  // Element initialization
  container.empty();
  var visibleWidth = container.width();
  var thumbnailContainer = $("<div />");
  container.append(thumbnailContainer);
  var thumbnailContainerWidth;

  _.each(elements, function(el) {
    thumbnailContainer.append(el);
  });

  thumbnailContainerWidth = elements.length * thumbnailWidth;
  thumbnailContainer.width(thumbnailContainerWidth);

  var maxMovement = Math.max((elements.length - Math.floor(visibleWidth / thumbnailWidth)) - 2, 0);
  var modWidth = thumbnailWidth - ((visibleWidth % thumbnailWidth) / 2);

  // State
  var current = 0;
  var containerMoved = 0;
  var modAdded = 0;

  var nextIndex = _.partial(ST.utils.nextIndex, elements.length);
  var prevIndex = _.partial(ST.utils.prevIndex, elements.length);

  function next() {
    var newIdx = nextIndex(current);

    if(goingRight(newIdx)) {
      if(!isPosVisible(newIdx)) {
        moveRight(newIdx);
      }
    } else {
      moveBackLeft();
    }

    activate(newIdx);
  }

  function prev() {
    var newIdx = prevIndex(current);

    if(goingLeft(newIdx)) {
      if(!isPosVisible(newIdx)) {
        moveLeft(newIdx);
      }
    } else {
      moveBackRight();
    }

    activate(newIdx);
  }

  function show(newIdx) {
    if(goingRight(newIdx) && !isPosVisible(newIdx)) {
      moveRight(newIdx);
    }

    if(goingLeft(newIdx) && !isPosVisible(newIdx)) {
      moveLeft(newIdx);
    }

    activate(newIdx);
  }

  function activate(idx) {
    var old = current;
    current = idx;
    elements[old].removeClass(selectedClass);
    elements[current].addClass(selectedClass);
  }

  function isPosVisible(idx) {
    var thumbStart = idx * thumbnailWidth;
    var thumbEnd = thumbStart + thumbnailWidth;
    var start = (containerMoved * thumbnailWidth) + (modAdded * modWidth);
    var end = start + visibleWidth;
    return start <= thumbStart && thumbEnd <= end;
  }

  function goingLeft(newIdx) {
    return newIdx < current;
  }

  function goingRight(newIdx) {
    return newIdx > current;
  }

  function moveRight(newIdx) {
    var firstMove = containerMoved == 0 && modAdded == 0;
    var lastMove = newIdx === elements.length - 1;

    if(lastMove) {
      modAdded = 2;
    } else if(firstMove) {
      modAdded = 1;
    } else {
      containerMoved++;
    }

    move(containerMoved, modAdded);
  }

  function moveLeft(newIdx) {
    var firstMove = containerMoved == maxMovement && modAdded == 2;
    var lastMove = newIdx === 0;

    if(lastMove) {
      modAdded = 0;
    } else if(firstMove) {
      modAdded = 1;
    } else {
      containerMoved--;
    }

    move(containerMoved, modAdded);
  }

  function moveBackLeft() {
    modAdded = 0;
    containerMoved = 0;

    move(containerMoved, modAdded);
  }

  function moveBackRight() {
    modAdded = 2;
    containerMoved = maxMovement;

    move(containerMoved, modAdded);
  }

  function move(wholeMoves, partialMoves) {
    thumbnailContainer.transition({ x: (-1 * ((wholeMoves * thumbnailWidth) + (partialMoves * modWidth)) ) });
  }

  return {
    next: next,
    prev: prev,
    show: show
  }
}

ST.imageCarousel = function(images, currentImageId) {
  var tmpl = _.template($("#image-frame-template").html());
  var thumbnailTmpl = _.template($("#image-thumbnail-template").html());
  var leftLink = $("#listing-image-navi-left");
  var rightLink = $("#listing-image-navi-right");
  var container = $("#listing-image-frame");
  var thumbnailContainer = $("#listing-image-thumbnails");
  var thumbnailOverflow = $("#listing-image-thumbnails-mask");

  var imageIds = _(images).map(function(image) { return image.id }).value();
  var currentIdx = _.indexOf(imageIds, currentImageId);

  var elements = _.map(images, function(image) {
    return $(tmpl({url: image.images.big, aspectRatioClass: image.aspectRatio }));
  });

  var stripe;

  var promiseQueue = (function() {
    var q = [];

    function run(callback) {
      q.push(callback);

      if(q.length === 1) {
        purgeQueue();
      }
    }

    function purgeQueue() {
      var next = q.shift();
      if(next) {
        next().done(purgeQueue);
      }
    }

    return {
      run: run
    }
  })();

  var thumbnails = _.map(images, function(image, idx) {
    var thumbnailElement = $(thumbnailTmpl({url: image.images.thumb }));
    thumbnailElement.click(function() {
      stripe.show(idx);

      var goingRight = idx > currentIdx;
      var goingLeft = idx < currentIdx;

      var oldElement = elements[currentIdx];
      currentIdx = idx;
      var newElement = elements[currentIdx];

      if(goingRight) {
        swipeLeft(newElement, oldElement);
      }
      if(goingLeft) {
        swipeRight(newElement, oldElement);
      }
    });
    return thumbnailElement;
  });

  stripe = ST.thumbnailStripe($("#thumbnail-stripe"), thumbnails, {thumbnailWidth: 64});

  stripe.show(0);

  _.each(elements, function(el) {
    el.hide();
    container.append(el);
  });

  elements[currentIdx].show();

  function prevId(currId, length) {
    if (currId === 0) {
      return length - 1;
    } else {
      return currId - 1
    }
  }

  function nextId(currId, length) {
    return (currId + 1) % length;
  }

  var swipeDelay = 400;

  leftLink.asEventStream("click").doAction(".preventDefault").debounceImmediate(swipeDelay).onValue(function() {
    var oldElement = elements[currentIdx];
    currentIdx = prevId(currentIdx, elements.length);
    var newElement = elements[currentIdx];

    promiseQueue.run(function() {
      return swipeRight(newElement, oldElement);
    });

    stripe.prev();
  });

  function swipeRight(newElement, oldElement) {
    newElement.transition({ x: -1 * newElement.width() }, 0);
    newElement.show();

    var oldDone = oldElement.transition({ x: oldElement.width() }, swipeDelay).promise();
    var newDone = newElement.transition({ x: 0 }, swipeDelay).promise();

    var bothDone = $.when(newDone, oldDone)
    bothDone.done(function() {
      oldElement.hide();
    });

    return bothDone;
  }

  function swipeLeft(newElement, oldElement) {
    newElement.transition({ x: newElement.width() }, 0);
    newElement.show();
    var oldDone = oldElement.transition({ x: -1 * oldElement.width() }, swipeDelay).promise();
    var newDone = newElement.transition({ x: 0 }, swipeDelay).promise();

    var bothDone = $.when(newDone, oldDone)
    bothDone.done(function() {
      oldElement.hide();
    });

    return bothDone;
  }

  thumbnailsMoved = 0;

  rightLink.asEventStream("click").doAction(".preventDefault").debounceImmediate(swipeDelay).onValue(function() {
    var oldElement = elements[currentIdx];
    currentIdx = nextId(currentIdx, elements.length);
    var newElement = elements[currentIdx];

    promiseQueue.run(function() {
      return swipeLeft(newElement, oldElement);
    });

    stripe.next();
  });
}