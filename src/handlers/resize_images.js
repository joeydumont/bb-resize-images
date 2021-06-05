// Create a client to read objects from S3
const AWS = require('aws-sdk');
const s3 = new AWS.S3({
    signatureVersion: 'v4'
});
AWS.config.logger = console.log;

// Libraries for image resize.
const s3s = require('s3-streams');
const util = require('util');
const stream = require('stream');
const sharp = require('sharp');

const readStreamFromS3 = ({Bucket, Key}) => {
    return s3s.ReadStream(s3, {
        Bucket: Bucket,
        Key: Key,
    });
};

const writeStreamToS3 = ({Bucket, Key, FileFormat}) => {
    let ContentType;
    if (FileFormat == ".jpg") {
        ContentType = 'image/jpeg';
    }

    else if (FileFormat == ".png") {
        ContentType = 'image/png';
    }

    return s3s.WriteStream(s3, {
        Bucket: Bucket,
        Key: Key,
        ContentType: ContentType,
    });
};

const resizeStream = ({width, height}) => {
    return sharp()
        .resize(width, height)
        .max();
};

const readMetadataStream = () => {
    return sharp()
        .metadata()
}

/**
  * A Lambda function that copies the uploaded file to another prefix, then resizes it.
  */
exports.resizeImagesHandler = async (event, context) => {
    const getObjectRequests = event.Records.map(async (record) => {
        const params = {
            Bucket: record.s3.bucket.name,
            Key: record.s3.object.key,
        };

        const imageType = params.Key.match(/\.([^.])*$/)[0].toLowerCase();

        if (imageType != ".jpg" && imageType != ".png") {
            return;
        }

        try {
            // Determine the new keys
            const newKeyMove = 'orig/' + params.Key;

            // Pipeline to copy the original S3 object to a different location.
            const pipeline = util.promisify(stream.pipeline);
            const readStreamOrig = readStreamFromS3(params);
            const writeStreamOrig = writeStreamToS3({Bucket: params.Bucket, Key: newKeyMove, FileFormat: imageType});
            await pipeline(readStreamOrig, writeStreamOrig);

            // Pipeline to resize the original file and write the new in the original upload location.
            const pipelineResize = util.promisify(stream.pipeline);
            const readStream = readStreamFromS3({Bucket: params.Bucket, Key: newKeyMove});
            const resizeStreamVar = resizeStream({width: 500, height: 500});
            const writeStream = writeStreamToS3({Bucket: params.Bucket, Key: params.Key, FileFormat: imageType});
            await pipelineResize(readStream, resizeStreamVar, writeStream);

        } catch (error) {
            console.log('Error : ' + error);
            console.error('Error :' + error);
            throw error;
        }
    });

    await Promise.all(getObjectRequests);
};
