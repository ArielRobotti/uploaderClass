import Uploader "./uploader";
import Map "mo:map/Map";
import { nhash } "mo:map/Map";
import Nat "mo:base/Nat";
import Debug "mo:base/Debug";
import Types "types";
import Prim "mo:⛔";

shared ({caller}) actor class (_owner: Principal) = {

    type Uploader = Uploader.Uploader;
    type UploadResponse = Types.UploadResponse;
    type TempAsset = Types.TempAsset;
    type Asset = Types.AssetSave;
    type Chunk = Types.Chunk;
    type Result<T, U> = { #Ok : T; #Err : U };
    type FileID = Nat;

    stable let deployer = caller;
    stable let owner = _owner;
    
    stable var fileId = 31415;
    var tempFileId = 0;

    stable let files = Map.new<Nat, Asset>();
    let tempFiles = Map.new<Nat, TempAsset>();
    func authorizedCaller(p: Principal): Bool {
        p == deployer or p == owner;
    };
    func getId(v: {#File; #Temp}): Nat {
        switch v {
            case (#File) {
                fileId += 1;
                fileId - 1;
            };
            case (#Temp) {
                tempFileId += 1;
                tempFileId -1;
            }
        }
    };
    func frezze<T>(arr: [var T]): [T]{  
        Prim.Array_tabulate<T>(arr.size(), func x = arr[x])
    };
    ///////////////////////////////// Upload ///////////////////////////////////////////

    public shared ({caller}) func uploadRequest(fileName : Text, fileSize : Nat) : async UploadResponse {
        // assert(authorizedCaller(caller));
        let chunkSize = 1_000_000;   // Tamaño en Bytes de los "Chuncks" 1_048_576 //1MB
        let chunksQty = fileSize / chunkSize + (if (fileSize % chunkSize > 0) {1} else {0});
        let content_chunks = Prim.Array_init<Blob>(chunksQty, "");
        let id = getId(#Temp);
        let newAsset = {
            fileName;
            modified: Int = Prim.nat64ToNat(Prim.time());
            content_chunks;
            chunks_qty = chunksQty;
            total_length = fileSize;
            certified = false;
        };
        ignore Map.put<FileID, TempAsset>(tempFiles, nhash, id, newAsset);
        {id; chunksQty; chunkSize};
    };

    public shared ({caller}) func addChunck(tfId :Nat, chunk : Blob, index : Nat) : async Result<(), Text> {
        // assert(authorizedCaller(caller));
        Debug.print("Guardando " # Nat.toText(chunk.size()) # " Bytes from Chunk Nro " # Nat.toText(index));
        let file = Map.get<Nat, TempAsset>(tempFiles, nhash, tfId);
            switch file {
                case null {#Err("Archivo de carga no encontrado")};
                case (?file) {
                    file.content_chunks[index] := chunk;
                    #Ok
                }
            }  
    };
    
    public shared ({caller}) func commitLoad(tfId : Nat) : async Result<Nat, Text> {
        // assert(authorizedCaller(caller));
        let file = Map.get<Nat, TempAsset>(tempFiles, nhash, tfId);
        switch file {
            case null { 
                return #Err("No se encuentra el Id")
            };
            case (?file){
            var size = 0;
            for (ch in file.content_chunks.vals()){
                        size += ch.size();
            };
            if(size != file.total_length){
                Map.delete(tempFiles, nhash, tfId);
                return #Err("Tamaño incorrecto");
            };
            let content_chunks = frezze<Chunk>(file.content_chunks);
            let id = getId(#File);
            ignore Map.put<Nat, Asset>(files, nhash, id, {file with content_chunks});
            Map.delete(tempFiles, nhash, tfId);
            #Ok(id)
            }
        };
    };

    ////////////////////////// Download ///////////////////////////////

    public query ({caller}) func startDownload(_fileId : Nat) : async Result<Asset, Text> {
        // assert(authorizedCaller(caller));
        let file = Map.get(files, nhash, _fileId);
        switch file {
            case null { #Err("File Not Found") };
            case (?file) { #Ok({ file with content_chunks = [] }) };
        };
    };

    public query ({caller}) func getChunck(_fileId : Nat, chunckIndex : Nat) : async Result<Blob, Text> {
        // assert(authorizedCaller(caller));
        let file = Map.get(files, nhash, _fileId);
        switch file {
            case null { #Err("File Not Found") };
            case (?file) {
                #Ok(file.content_chunks[chunckIndex]);
            };
        };
    };
    ////////////////////////////////////////////////////////////////////
};